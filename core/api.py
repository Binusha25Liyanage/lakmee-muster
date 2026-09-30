"""
API object exposed to the UI (window.pywebview.api.<method>).
Every public method returns plain JSON-serialisable data.
Methods starting with "_" are private and not visible to JavaScript.
"""
import base64
import datetime
import importlib
import io
import os
import sys
import time

from reportlab.pdfgen import canvas

from . import renderer, storage

APP_NAME = "Lakmee Muster"
APP_VERSION = "1.0.0"

MODULE_FILES = {"rep": "modules.rep_attendance", "employee": "modules.employee_attendance"}


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
        for mid in MODULE_FILES:
            try:
                mods.append(_module(mid).MODULE_INFO)
            except Exception as e:  # a broken module must not stop the app
                mods.append({"id": mid, "name": mid, "version": "error", "error": str(e)})
        return {"name": APP_NAME, "version": APP_VERSION, "modules": mods,
                "data_dir": storage.data_dir(), "platform": sys.platform}

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
    def load_source(self, path):
        """Detects which module owns the file, parses it, applies saved name corrections."""
        if not path or not os.path.exists(path):
            return {"ok": False, "error": "File not found."}
        t0 = time.time()
        for mid in ("rep", "employee"):
            mod = _module(mid)
            try:
                if not mod.detect(path):
                    continue
                if mid != "rep":
                    return {"ok": False, "error": "This looks like an employee attendance file. "
                            "Employee parsing arrives in the next milestone."}
                data = mod.load(path)
            except Exception as e:
                return {"ok": False, "error": str(e)}
            data["auto_fixed"] = self._apply_corrections(data)
            self._data, self._source = data, path
            return {"ok": True, "data": data, "module": mod.MODULE_INFO,
                    "file": {"name": os.path.basename(path), "path": path,
                             "size": os.path.getsize(path), "ms": int((time.time() - t0) * 1000)}}
        return {"ok": False, "error": "Could not recognise this Excel file. Supported: SFA RepAttendance export."}

    def _apply_corrections(self, data):
        fixes = {c["original"]: c["corrected"] for c in storage.get_corrections() if c.get("auto")}
        n = 0
        if not fixes:
            return 0
        for rec in data["records"]:
            for k, v in list(rec.items()):
                if isinstance(v, str) and v in fixes:
                    rec[k] = fixes[v]
                    n += 1
        return n

    # ------------------------------------------------------------ corrections / edits
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

    def _template(self, tid):
        for t in self.templates():
            if t["id"] == tid:
                return {**renderer.DEFAULT_TEMPLATE, **t}
        return renderer.DEFAULT_TEMPLATE

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
        tables = mod.build_tables(self._data, p["rows"], p["columns"], p.get("mode", "split"), p.get("sort", "excel"))
        if not tables:
            raise ValueError("No rows match this filter, nothing to draw.")
        tpl = self._template(p.get("template", "classic-grid"))
        style = p.get("date_format") or tpl.get("date_format", "MM/DD/YYYY")
        title = (p.get("title") or tpl["title"]).replace("{date}", _fmt_date(self._data.get("date"), style)).strip()
        return tables, tpl, title

    def preview(self, p):
        """p = {rows, columns, mode, sort, template, title, date_format}. Returns base64 PNGs (screen resolution)."""
        try:
            tables, tpl, title = self._tables(p)
            out = []
            for name, headers, rows in tables:
                png = renderer.render_png(tpl, title, headers, rows, dpi=int(p.get("dpi_preview", 150)))
                out.append({"name": name, "count": len(rows),
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
            date_txt = (self._data.get("date") or "").replace("-", "")
            scope = p.get("scope", "AllReps")
            base = (p.get("naming") or "{Module}_{Scope}_{Date}").replace("{Module}", "Rep") \
                .replace("{Scope}", scope).replace("{Date}", date_txt)
            if p.get("want_pdf", True):
                os.makedirs(f["pdf"], exist_ok=True)
                pdf_path = os.path.join(f["pdf"], base + ".pdf")
                c = canvas.Canvas(pdf_path)
                for _, headers, rows in tables:
                    renderer.draw_pdf_page(c, tpl, title, headers, rows)
                c.save()
                written.append(pdf_path)
            if p.get("want_png", True):
                for i, (name, headers, rows) in enumerate(tables):
                    folder = f["img1"] if i == 0 else f["img2"]
                    os.makedirs(folder, exist_ok=True)
                    path = os.path.join(folder, f"{base}_{name}.png")
                    with open(path, "wb") as fh:
                        fh.write(renderer.render_png(tpl, title, headers, rows, dpi=dpi))
                    written.append(path)
            storage.save_settings({"img1_folder": f["img1"], "img2_folder": f["img2"], "pdf_folder": f["pdf"],
                                   "dpi": dpi, "naming": p.get("naming") or "{Module}_{Scope}_{Date}"})
            entry = storage.add_history({
                "module": "Rep Attendance", "scope": scope, "source": os.path.basename(self._source or ""),
                "template": tpl["name"], "files": written, "edited": int(p.get("edits", 0)),
                "date": self._data.get("date")})
            return {"ok": True, "files": written, "history": entry}
        except Exception as e:
            return {"ok": False, "error": str(e)}
