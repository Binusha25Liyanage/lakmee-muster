"""
API object exposed to the UI (window.pywebview.api.<method>).
Every public method returns plain JSON-serialisable data.
Methods starting with "_" are private and not visible to JavaScript.
"""
import base64
import datetime
import importlib
import importlib.util
import json
import os
import shutil
import sys
import time

from reportlab.pdfgen import canvas

from . import database, renderer, storage, xlsx_out

APP_NAME = "Lakmee Muster"
APP_VERSION = "1.4.0"

MODULE_FILES = {"rep": "modules.rep_attendance", "employee": "modules.employee_attendance"}
MODULE_SHORT = {"rep": "Rep", "employee": "Employee"}
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REQUIRED = ("MODULE_INFO", "detect", "load", "build_tables")


def _module(mid):
    return importlib.import_module(MODULE_FILES[mid])


def _fmt_date(iso, style):
    if not iso:
        return ""
    d = datetime.datetime.strptime(iso[:10], "%Y-%m-%d")
    return {"MM/DD/YYYY": d.strftime("%m/%d/%Y"), "DD/MM/YYYY": d.strftime("%d/%m/%Y"),
            "YYYY-MM-DD": d.strftime("%Y-%m-%d"), "DD-MMM-YYYY": d.strftime("%d-%b-%Y").upper()}.get(style, iso)


class Api:
    def __init__(self):
        self._window = None
        self._data = None
        self._source = None

    def _bind(self, window):
        self._window = window

    # ------------------------------------------------------------ app / window
    def app_info(self):
        mods = []
        for mid, modname in MODULE_FILES.items():
            path = os.path.join(HERE, modname.replace(".", os.sep) + ".py")
            try:
                info = dict(_module(mid).MODULE_INFO)
            except Exception as e:  # a broken module must not stop the app
                info = {"id": mid, "name": mid, "version": "error", "error": str(e)}
            info["file"] = os.path.relpath(path, HERE).replace("\\", "/")
            info["has_backup"] = os.path.exists(path + ".bak")
            mods.append(info)
        return {"name": APP_NAME, "version": APP_VERSION, "modules": mods,
                "data_dir": storage.data_dir(), "platform": sys.platform,
                "now": datetime.datetime.now().isoformat(timespec="seconds")}

    def win_minimize(self):
        if self._window:
            self._window.minimize()

    def win_toggle_maximize(self):
        if self._window:
            if getattr(self, "_maxed", False):
                self._window.restore()
            else:
                self._window.maximize()
            self._maxed = not getattr(self, "_maxed", False)
        return getattr(self, "_maxed", False)

    def win_close(self):
        if self._window:
            self._window.destroy()

    # ------------------------------------------------------------ dialogs
    def pick_file(self):
        import webview
        r = self._window.create_file_dialog(
            webview.OPEN_DIALOG, allow_multiple=False,
            file_types=("Excel files (*.xlsx;*.xlsm)", "All files (*.*)"))
        return r[0] if r else None

    def pick_other(self, kind="json"):
        import webview
        types = {"json": ("Template files (*.json)", "All files (*.*)"),
                 "py": ("Python module (*.py)", "All files (*.*)")}[kind]
        r = self._window.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=False, file_types=types)
        return r[0] if r else None

    def pick_folder(self, current=""):
        import webview
        r = self._window.create_file_dialog(webview.FOLDER_DIALOG, directory=current or "")
        return r[0] if r else None

    def open_folder(self, path):
        if path and os.path.isdir(path):
            if sys.platform == "win32":
                os.startfile(path)  # noqa
            return True
        return False

    def reveal_file(self, path):
        if path and os.path.exists(path) and sys.platform == "win32":
            os.startfile(os.path.dirname(path))  # noqa
            return True
        return False

    # ------------------------------------------------------------ loading
    def load_source(self, path, sheet=None):
        """Detects which module owns the file, parses it, applies saved name corrections."""
        if not path or not os.path.exists(path):
            return {"ok": False, "error": "File not found."}
        t0 = time.time()
        late = storage.get_settings().get("late_after", "08:15")
        for mid in ("rep", "employee"):
            mod = _module(mid)
            try:
                if not mod.detect(path):
                    continue
                data = mod.load(path, sheet=sheet, late_after=late)
            except Exception as e:
                return {"ok": False, "error": str(e)}
            data["auto_fixed"] = self._apply_corrections(data)
            if data.get("roster_learn"):
                storage.learn_roster(data["roster_learn"])
            self._data, self._source = data, path
            return {"ok": True, "data": data, "module": mod.MODULE_INFO,
                    "file": {"name": os.path.basename(path), "path": path,
                             "size": os.path.getsize(path), "ms": int((time.time() - t0) * 1000)}}
        return {"ok": False, "error": "Could not recognise this Excel file. Supported: SFA RepAttendance export, "
                                      "staff monthly sheet, biometric transaction export."}

    def _apply_corrections(self, data):
        fixes = {c["original"]: c["corrected"] for c in storage.get_corrections() if c.get("auto")}
        n = 0
        if not fixes:
            return 0
        skip = set(data.get("status_cols", [])) | {"SECTION", "NO"}
        for rec in data["records"]:
            for k, v in list(rec.items()):
                if k in skip or not isinstance(v, str):
                    continue
                if v in fixes:
                    rec[k] = fixes[v]
                    n += 1
        return n

    def recalc(self, rows):
        """Recomputes calculated columns (e.g. employee totals) after edits."""
        if not self._data:
            return rows
        mod = _module(self._data["module"])
        fn = getattr(mod, "recalc", None)
        late = storage.get_settings().get("late_after", "08:15")
        return fn(self._data, rows, late) if fn else rows

    # ------------------------------------------------------------ corrections
    def corrections(self):
        return storage.get_corrections()

    def add_correction(self, original, corrected, auto=True):
        return storage.add_correction(original, corrected, auto)

    def delete_correction(self, cid):
        return storage.delete_correction(cid)

    def set_correction_auto(self, cid, auto):
        return storage.set_correction_auto(cid, auto)

    # ------------------------------------------------------------ templates
    def templates(self):
        return renderer.BUILTIN_TEMPLATES + storage.get_user_templates()

    def save_template(self, tpl):
        return storage.save_user_template({**renderer.DEFAULT_TEMPLATE, **tpl})

    def delete_template(self, tid):
        storage.delete_user_template(tid)
        return self.templates()

    def import_template(self, path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                obj = json.load(f)
            items = obj if isinstance(obj, list) else [obj]
            n = 0
            for t in items:
                if not isinstance(t, dict) or "title" not in t:
                    continue
                t = {k: v for k, v in t.items() if k in renderer.DEFAULT_TEMPLATE}
                t["id"] = ""            # always import as a new template
                t["name"] = t.get("name") or os.path.splitext(os.path.basename(path))[0]
                storage.save_user_template({**renderer.DEFAULT_TEMPLATE, **t})
                n += 1
            if not n:
                return {"ok": False, "error": "No template found in that file (it needs at least a 'title')."}
            return {"ok": True, "count": n, "templates": self.templates()}
        except Exception as e:
            return {"ok": False, "error": f"Could not read the template file: {e}"}

    def export_template(self, tid, folder):
        t = next((x for x in self.templates() if x["id"] == tid), None)
        if not t or not folder:
            return {"ok": False, "error": "Nothing to export."}
        os.makedirs(folder, exist_ok=True)
        path = os.path.join(folder, f"template_{tid}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump({k: v for k, v in t.items() if k != "builtin"}, f, indent=2, ensure_ascii=False)
        return {"ok": True, "path": path}

    def template_sample(self, tpl):
        """Draws a small sample table so the template editor can show a live preview."""
        t = {**renderer.DEFAULT_TEMPLATE, **tpl}
        headers = ["NAME", "1", "2", "3", "4", "5", "LEAVES"] if t.get("status_colors") else ["TERRITORY", "LOGGED IN", "LOGGED OUT"]
        rows = ([["Nimal Perera", "P", "P", "L", "H", "Ab", "1"], ["Kasun Silva", "P", "HD", "P", "V", "P", "0"],
                 ["Dilani Fernando", "L", "P", "P", "P", "P", "1"]] if t.get("status_colors")
                else [["Colombo Central", "07:16:03", ""], ["Kandy Metro", "08:29:51", "17:40:12"], ["Galle Fort", "07:47:01", ""]])
        try:
            png = renderer.render_png(t, (t["title"] or "TITLE").replace("{date}", "09/28/2026").replace("{month}", "SEPTEMBER 2026"),
                                      headers, rows, dpi=150)
            return {"ok": True, "data_url": "data:image/png;base64," + base64.b64encode(png).decode()}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def _template(self, tid):
        for t in self.templates():
            if t["id"] == tid:
                return {**renderer.DEFAULT_TEMPLATE, **t}
        return renderer.DEFAULT_TEMPLATE

    # ------------------------------------------------------------ module updates
    def update_module(self, mid, path):
        """Replace a module file with a new one (validated first). The old file is kept as <file>.bak."""
        if mid not in MODULE_FILES:
            return {"ok": False, "error": "Unknown module."}
        try:
            spec = importlib.util.spec_from_file_location("_candidate_" + mid, path)
            cand = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(cand)
            missing = [n for n in REQUIRED if not hasattr(cand, n)]
            if missing:
                return {"ok": False, "error": "This file is not a valid module. Missing: " + ", ".join(missing)}
            if cand.MODULE_INFO.get("id") != mid:
                return {"ok": False, "error": f"This file is for the '{cand.MODULE_INFO.get('id')}' module, not '{mid}'."}
        except Exception as e:
            return {"ok": False, "error": f"The file could not be loaded: {e}"}
        target = os.path.join(HERE, MODULE_FILES[mid].replace(".", os.sep) + ".py")
        if os.path.abspath(path) == os.path.abspath(target):
            return {"ok": False, "error": "That is the module file already in use. Choose the new version of the file."}
        shutil.copyfile(target, target + ".bak")
        shutil.copyfile(path, target)
        importlib.reload(_module(mid))
        return {"ok": True, "info": self.app_info()}

    def restore_module(self, mid):
        target = os.path.join(HERE, MODULE_FILES[mid].replace(".", os.sep) + ".py")
        if not os.path.exists(target + ".bak"):
            return {"ok": False, "error": "There is no previous version to restore."}
        shutil.copyfile(target + ".bak", target)
        importlib.reload(_module(mid))
        return {"ok": True, "info": self.app_info()}

    # ------------------------------------------------------------ employee roster
    def now(self):
        """The device clock and calendar (the UI also reads them, this is the Python side)."""
        n = datetime.datetime.now()
        return {"iso": n.isoformat(timespec="seconds"), "date": n.date().isoformat(), "time": n.strftime("%H:%M:%S")}

    def roster(self):
        return storage.get_roster()

    def roster_exclude(self, eid, excluded=True):
        return storage.set_roster_excluded(eid, excluded)

    def roster_add(self, eid, name, dept):
        if not str(eid).strip() or not str(name).strip():
            return storage.get_roster()
        return storage.add_roster(eid, name, dept)

    def roster_delete(self, eid):
        return storage.delete_roster(eid)

    # ------------------------------------------------------------ attendance database
    def db_stats(self):
        return database.stats()

    def db_people(self, kind):
        return database.people(kind)

    def db_query(self, p):
        try:
            return database.query(p, storage.get_settings().get("late_after", "08:15"))
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def db_add_file(self, path):
        """Reads an Excel file and stores it in the database without going through the export wizard."""
        if not path or not os.path.exists(path):
            return {"ok": False, "error": "File not found."}
        late = storage.get_settings().get("late_after", "08:15")
        for mid in ("rep", "employee"):
            mod = _module(mid)
            try:
                if not mod.detect(path):
                    continue
                data = mod.load(path, late_after=late)
            except Exception as e:
                return {"ok": False, "error": str(e)}
            if data.get("roster_learn"):
                storage.learn_roster(data["roster_learn"])
            n = database.save_rows(data, [r for r in data["records"] if not r.get("_skip")], path)
            return {"ok": True, "saved": n, "kind": data.get("kind_label", mid), "date": data.get("date_label")}
        return {"ok": False, "error": "Could not recognise this Excel file."}

    def db_delete(self, kind, start, end):
        return {"ok": True, "deleted": database.delete_range(kind, start, end), "stats": database.stats()}

    def db_export(self, p, folder):
        """Saves the current filter result as an Excel file (Summary + Records sheets)."""
        try:
            r = database.query(p, storage.get_settings().get("late_after", "08:15"))
            emp = r["kind"] != "rep"
            sub = f"{r['label']}: {r['from']} to {r['to']}" if p.get("preset") != "all" else "All time"
            sh = []
            sh.append({"style": "daily", "name": "Summary", "title": ("Employee" if emp else "Rep") + " Attendance Summary",
                       "subtitle": sub,
                       "headers": ["ID", "Name", "Department" if emp else "Region", "Days", "Present", "Leave", "Absent", "Late" if emp else "Not logged out", "Avg check-in"],
                       "rows": [[s["id"], s["who"], s["group"], s["days"], s["present"], s["leave"], s["absent"], s["late"] if emp else s["no_out"], s["avg_in"]] for s in r["summary"]],
                       "widths": {1: 12, 2: 26, 3: 18, 4: 8, 5: 9, 6: 8, 7: 9, 8: 14, 9: 13}, "band": 0, "band_color": "EFE9F5",
                       "head_fill": "4A4743", "aligns": ["l", "l", "l", "c", "c", "c", "c", "c", "c"]})
            sh.append({"style": "daily", "name": "Records", "title": ("Employee" if emp else "Rep") + " Attendance Records",
                       "subtitle": sub, "headers": ["Date", "ID", "Name", "Department" if emp else "Territory", "Status", "Check in", "Check out", "Source"],
                       "rows": [[x["day"], x.get("emp_id") or x.get("rep_code") or "", x["name"] if emp else x["rep_name"], x["group"] if emp else x["territory"],
                                 x.get("status") or "", x["check_in"], x["check_out"], x.get("source") or ""] for x in r["records"]],
                       "widths": {1: 12, 2: 10, 3: 26, 4: 22, 5: 8, 6: 10, 7: 10, 8: 34}, "band": 0, "band_color": "EFE9F5",
                       "head_fill": "4A4743", "aligns": ["l"] * 8})
            os.makedirs(folder, exist_ok=True)
            name = f"{'Employee' if emp else 'Rep'}_Attendance_{r['from'] if p.get('preset') != 'all' else 'All'}_{r['to'] if p.get('preset') != 'all' else 'time'}.xlsx"
            path = xlsx_out.write_workbook(os.path.join(folder, name), sh)
            return {"ok": True, "path": path}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    # ------------------------------------------------------------ settings / history
    def settings(self):
        return storage.get_settings()

    def save_settings(self, patch):
        return storage.save_settings(patch)

    def history(self):
        return storage.get_history()

    def delete_history(self, hid):
        return storage.delete_history(hid)

    # ------------------------------------------------------------ rendering
    def _tables(self, p):
        if not self._data:
            raise ValueError("Import an Excel file first.")
        mod = _module(self._data["module"])
        late = storage.get_settings().get("late_after", "08:15")
        extra = {k: p[k] for k in ("include_empty", "hidden", "sheet_opts") if k in p}
        extra["roster"] = [r for r in storage.get_roster() if not r["excluded"]]
        tables = mod.build_tables(self._data, p["rows"], p["columns"], p.get("mode", "split"), p.get("sort", "excel"), late, **extra)
        if not tables:
            raise ValueError("No rows match this filter, nothing to draw.")
        tpl = self._template(p.get("template") or self._data.get("default_template", "classic-grid"))
        style = p.get("date_format") or tpl.get("date_format", "MM/DD/YYYY")
        title = (p.get("title") or tpl["title"]).replace("{date}", _fmt_date(self._data.get("date"), style)) \
            .replace("{month}", self._data.get("month_label", "")).strip()
        return tables, tpl, title

    def _spec(self, headers, tpl, p):
        """Exact-copy layouts carry no title unless the user typed one."""
        custom = (p.get("title") or "").strip()
        custom = custom.replace("{date}", _fmt_date(self._data.get("date"), p.get("date_format") or "MM/DD/YYYY")) \
            .replace("{month}", self._data.get("month_label", ""))
        return renderer.spec_with_title(headers, custom, tpl)

    def preview(self, p):
        """p = {rows, columns, mode, sort, template, title, date_format}. Returns base64 PNGs (screen resolution)."""
        try:
            tables, tpl, title = self._tables(p)
            out = []
            for name, headers, rows in tables:
                if rows is None:                                   # exact-copy layout
                    spec = self._spec(headers, tpl, p)
                    png = renderer.render_png_spec(tpl, spec, dpi=min(int(p.get("dpi_preview", 150)), 110))
                    count = headers.get("count", 0)
                else:
                    png = renderer.render_png(tpl, title, headers, rows, dpi=int(p.get("dpi_preview", 150)))
                    count = len(rows)
                out.append({"name": name, "count": count,
                            "data_url": "data:image/png;base64," + base64.b64encode(png).decode()})
            return {"ok": True, "images": out, "title": title}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def export(self, p):
        """p adds: folders {img1,img2,pdf}, dpi, want_png, want_pdf, scope (label for history/naming)."""
        try:
            tables, tpl, title = self._tables(p)
            f = p["folders"]
            dpi = int(p.get("dpi", 300))
            written = []
            mid = self._data["module"]
            if p.get("mode") in ("xlsx_daily", "xlsx_weeks"):
                late = storage.get_settings().get("late_after", "08:15")
                wbk = _module(mid).build_workbook(self._data, p["rows"], p["mode"], late,
                                                  roster=[r for r in storage.get_roster() if not r["excluded"]],
                                                  include_absent=p.get("include_empty", True))
                xf = f.get("xlsx") or f.get("pdf")
                os.makedirs(xf, exist_ok=True)
                xpath = os.path.join(xf, wbk["filename"] + ".xlsx")
                xlsx_out.write_workbook(xpath, wbk["sheets"])
                written.append(xpath)
            scope = p.get("scope", "All")
            base = (p.get("naming") or "{Module}_{Scope}_{Date}").replace("{Module}", MODULE_SHORT[mid]) \
                .replace("{Scope}", scope).replace("{Date}", self._data.get("date_token", ""))
            if p.get("want_pdf", True) and not p.get("xlsx_only"):
                os.makedirs(f["pdf"], exist_ok=True)
                pdf_path = os.path.join(f["pdf"], base + ".pdf")
                c = canvas.Canvas(pdf_path)
                for _, headers, rows in tables:
                    if rows is None:
                        renderer.draw_pdf_spec(c, tpl, self._spec(headers, tpl, p))
                    else:
                        renderer.draw_pdf_page(c, tpl, title, headers, rows)
                c.save()
                written.append(pdf_path)
            if p.get("want_png", True) and not p.get("xlsx_only"):
                for i, (name, headers, rows) in enumerate(tables):
                    folder = f["img1"] if i == 0 else f["img2"]
                    os.makedirs(folder, exist_ok=True)
                    path = os.path.join(folder, f"{base}_{name}.png")
                    with open(path, "wb") as fh:
                        if rows is None:
                            fh.write(renderer.render_png_spec(tpl, self._spec(headers, tpl, p), dpi=dpi))
                        else:
                            fh.write(renderer.render_png(tpl, title, headers, rows, dpi=dpi))
                    written.append(path)
            try:
                saved = database.save_rows(self._data, p["rows"], self._source)
            except Exception:
                saved = None                      # the database must never block an export
            storage.save_settings({"img1_folder": f["img1"], "img2_folder": f["img2"], "pdf_folder": f["pdf"], "xlsx_folder": f.get("xlsx", ""),
                                   "dpi": dpi, "naming": p.get("naming") or "{Module}_{Scope}_{Date}"})
            entry = storage.add_history({
                "module": self._data.get("kind_label", MODULE_SHORT[mid]), "scope": scope,
                "source": os.path.basename(self._source or ""),
                "template": tpl["name"], "files": written, "edited": int(p.get("edits", 0)),
                "date": self._data.get("date")})
            return {"ok": True, "files": written, "history": entry, "db": saved}
        except Exception as e:
            return {"ok": False, "error": str(e)}
