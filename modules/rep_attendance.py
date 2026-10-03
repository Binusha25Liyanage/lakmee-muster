"""
Rep Attendance module  (independent of every other module)
----------------------------------------------------------
Reads the "RepAttendance Reports" Excel export from Lakmee SFA.

Public interface used by the app shell (core/api.py):
    MODULE_INFO                      -> dict(id, name, version)
    detect(path)                     -> bool
    load(path)                       -> dict(columns, records, date, keys, issues, stats)
    build_tables(data, rows, mode, sort) -> list of (name, columns, rows) ready to render

This file can be replaced/updated on its own without touching the employee module.
"""
import datetime
import re
import openpyxl

MODULE_INFO = {"id": "rep", "name": "Rep Attendance", "version": "1.0.0"}

DEFAULT_COLUMNS = ["TERRITORY", "LOGGED IN", "LOGGED OUT"]

MODES = {
    "split": "Two images: not logged out + logged out",
    "not_out": "Only reps NOT logged out",
    "out": "Only reps who logged out",
    "all": "All reps who logged in",
}
SORTS = {"excel": "Same order as Excel", "territory": "Territory A-Z", "login": "Login time"}


# ---------------------------------------------------------------- helpers
def _fmt(v):
    if v is None or v == "":
        return ""
    if isinstance(v, datetime.datetime):
        return v.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(v, datetime.time):
        return v.strftime("%H:%M:%S")
    if isinstance(v, datetime.date):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


def normalize_time(text):
    """'8.15 AM', '8:15', '08:15:00', '815' -> 'HH:MM:SS'. Returns None if it cannot be understood."""
    t = (text or "").strip().upper().replace(".", ":")
    if not t:
        return None
    m = re.fullmatch(r"(\d{1,2}):?(\d{2})(?::(\d{2}))?\s*(AM|PM)?", t)
    if not m:
        return None
    h, mi, s, ap = int(m.group(1)), int(m.group(2)), int(m.group(3) or 0), m.group(4)
    if ap == "PM" and h < 12:
        h += 12
    if ap == "AM" and h == 12:
        h = 0
    if h > 23 or mi > 59 or s > 59:
        return None
    return f"{h:02d}:{mi:02d}:{s:02d}"


def _find_header(ws):
    for row in ws.iter_rows(min_row=1, max_row=40):
        vals = [str(c.value).strip().upper() for c in row if c.value is not None]
        if "TERRITORY" in vals and "LOGGED IN" in vals:
            return row[0].row
    return None


# ---------------------------------------------------------------- interface
def detect(path):
    try:
        ws = openpyxl.load_workbook(path, read_only=False, data_only=True).active
        return _find_header(ws) is not None
    except Exception:
        return False


def load(path, sheet=None, late_after=None):
    ws = openpyxl.load_workbook(path, data_only=True).active
    header_row = _find_header(ws)
    if header_row is None:
        raise ValueError("This does not look like a RepAttendance export (no TERRITORY / LOGGED IN header found).")

    ncol = ws.max_column
    groups, cur = {}, ""
    for c in range(1, ncol + 1):
        g = ws.cell(header_row - 1, c).value if header_row > 1 else None
        if g:
            cur = str(g).strip()
        groups[c] = cur

    names = {c: str(ws.cell(header_row, c).value).strip() for c in range(1, ncol + 1)
             if ws.cell(header_row, c).value not in (None, "")}
    count = {}
    for n in names.values():
        count[n] = count.get(n, 0) + 1

    labels, header_of, col_of = [], {}, {}
    for c, n in names.items():
        label = n if count[n] == 1 else f"{n} ({groups[c] or 'col ' + str(c)})"
        while label in col_of:
            label += "'"
        labels.append(label)
        header_of[label] = n
        col_of[label] = c

    def first(name):
        return next(l for l in labels if header_of[l] == name)

    keys = {"terr": first("TERRITORY"), "in": first("LOGGED IN"), "out": first("LOGGED OUT")}
    date_l = next((l for l in labels if header_of[l] == "LOGGED IN DATE"), None)

    records, issues, date = [], [], None
    seen = {}
    for r in range(header_row + 1, ws.max_row + 1):
        terr = ws.cell(r, col_of[keys["terr"]]).value
        if not terr:
            continue
        rec = {l: _fmt(ws.cell(r, col_of[l]).value) for l in labels}
        rec["_row"] = r
        idx = len(records)
        records.append(rec)

        if date is None and date_l:
            d = ws.cell(r, col_of[date_l]).value
            try:
                date = d if isinstance(d, (datetime.date, datetime.datetime)) \
                    else datetime.datetime.strptime(str(d)[:10], "%Y-%m-%d")
            except Exception:
                pass

        # ---- data-quality checks (feed the "Review & Fix" screen)
        for key in ("in", "out"):
            raw = rec[keys[key]]
            if raw and not re.fullmatch(r"\d{2}:\d{2}:\d{2}", raw):
                fixed = normalize_time(raw)
                issues.append({
                    "id": f"{idx}-{key}", "index": idx, "row": r, "field": keys[key],
                    "who": str(terr).strip(), "kind": "time_format",
                    "message": f"Time '{raw}' is not in HH:MM:SS format",
                    "raw": raw, "suggest": fixed, "severity": "high" if fixed is None else "auto",
                })
        tname = str(terr).strip().lower()
        if tname in seen and rec[keys["in"]]:
            issues.append({
                "id": f"{idx}-dup", "index": idx, "row": r, "field": keys["terr"],
                "who": str(terr).strip(), "kind": "duplicate",
                "message": f"Territory also appears on row {seen[tname]}",
                "raw": str(terr).strip(), "suggest": None, "severity": "review",
            })
        seen.setdefault(tname, r)

    logged_in = [x for x in records if x[keys["in"]]]
    stats = {
        "total": len(records),
        "logged_in": len(logged_in),
        "not_out": len([x for x in logged_in if not x[keys["out"]]]),
        "out": len([x for x in logged_in if x[keys["out"]]]),
        "issues": len(issues),
    }
    labels_ = [c["label"] for c in [{"label": l} for l in labels]]
    name_l = next((l for l in labels if re.search(r"SALES REP$|REP NAME", header_of[l], re.I)), None)
    return {
        "module": MODULE_INFO["id"], "kind": "sfa", "kind_label": "SFA Rep Attendance",
        "sheets": [ws.title], "sheet": ws.title,
        "columns": [{"label": l, "header": header_of[l], "display": l} for l in labels],
        "records": records,
        "keys": {**keys, "label": keys["terr"]},
        "date": date.strftime("%Y-%m-%d") if date else None,
        "date_label": date.strftime("%Y-%m-%d") if date else "not found",
        "month_label": "", "date_token": date.strftime("%Y%m%d") if date else "",
        "issues": issues, "notes": [], "days": [], "status_cols": [], "status_options": [], "readonly": [],
        "modes": [{"id": "split", "title": "Two images: not logged out + logged out", "sub": "Recommended - one image for each group"},
                  {"id": "not_out", "title": "Only reps NOT logged out", "sub": "The active shift queue"},
                  {"id": "out", "title": "Only reps who logged out", "sub": "Completed shifts"},
                  {"id": "all", "title": "All reps who logged in", "sub": "One master image"}],
        "default_mode": "split",
        "sorts": [{"id": "excel", "title": "Same order as Excel"}, {"id": "territory", "title": "Territory A-Z"},
                  {"id": "login", "title": "Login time"}],
        "presets": [{"name": "Territory + times", "columns": [keys["terr"], keys["in"], keys["out"]]}]
                   + ([{"name": "With rep name", "columns": [keys["terr"], name_l, keys["in"], keys["out"]]}] if name_l else []),
        "default_columns": [keys["terr"], keys["in"], keys["out"]],
        "default_template": "classic-grid", "grid_template": "classic-grid",
        "review_cols": [keys["terr"], keys["in"], keys["out"]],
        "preview_cols": [keys["terr"]] + ([name_l] if name_l else []) + [keys["in"], keys["out"]],
        "stat_cards": [
            {"l": "Reps logged in", "v": stats["logged_in"], "s": f"of {stats['total']} territories in file"},
            {"l": "Reps not logged out", "v": stats["not_out"], "s": "still in the field"},
            {"l": "Reps logged out", "v": stats["out"], "s": "completed the day"},
            {"l": "Data issues", "v": stats["issues"], "s": "need review" if stats["issues"] else "file looks clean"},
        ],
        "stats": stats,
    }


def recalc(data, rows, late_after=None):
    return rows


def build_tables(data, rows, chosen, mode="split", sort="excel", late_after=None, **kw):
    """rows = the (possibly edited) records that are in scope.
    chosen = list of column labels in output order.
    Returns [(name, headers, table_rows)]."""
    keys = data["keys"]
    header_of = {c["label"]: c["header"] for c in data["columns"]}
    recs = [r for r in rows if r.get(keys["in"])]
    if sort == "territory":
        recs.sort(key=lambda r: r[keys["terr"]].lower())
    elif sort == "login":
        recs.sort(key=lambda r: r[keys["in"]])
    not_out = [r for r in recs if not r.get(keys["out"])]
    done = [r for r in recs if r.get(keys["out"])]
    sets = {"split": [("not_logged_out", not_out), ("logged_out", done)],
            "not_out": [("not_logged_out", not_out)],
            "out": [("logged_out", done)],
            "all": [("all", recs)]}[mode]
    headers = [header_of[l] for l in chosen]
    return [(n, headers, [[r.get(l, "") for l in chosen] for r in s]) for n, s in sets if s]
