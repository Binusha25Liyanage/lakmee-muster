"""
Employee Attendance module  (independent of every other module)
---------------------------------------------------------------
Reads two kinds of Excel files:
  * "monthly"   - the monthly staff sheet: one sheet per month, names down the side, two columns per day
                  (status P / Ab / L / H / Half-day / Visit, then an optional arrival time such as "8.08 am")
  * "biometric" - the daily biometric transaction export (Employee ID, First Name, Department, Time, Punch State)

Interface used by the app shell (core/api.py) - same as every module:
    MODULE_INFO, detect(path), load(path, sheet=None, late_after="08:15"),
    build_tables(data, rows, chosen, mode, sort, late_after), recalc(data, rows, late_after)

This file can be replaced/updated on its own without touching the rep module.
"""
import datetime
import re
from collections import Counter

import openpyxl

MODULE_INFO = {"id": "employee", "name": "Employee Attendance", "version": "1.0.0"}

MONTHS = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6, "jul": 7, "aug": 8, "sep": 9,
          "oct": 10, "nov": 11, "dec": 12}
STATUS_OPTIONS = ["P", "Ab", "L", "H", "HD", "V", ""]
STATUS_MAP = {"P": "P", "PRESENT": "P", "AB": "Ab", "A": "Ab", "ABSENT": "Ab", "L": "L", "LEAVE": "L", "H": "H",
              "HOLIDAY": "H", "HD": "HD", "HALF-DAY": "HD", "HALFDAY": "HD", "HALF DAY": "HD", "V": "V", "VISIT": "V"}
SUMMARY = ["PRESENT", "LEAVES", "HOLIDAYS", "HALF DAYS", "VISITS", "ABSENT", "LATE DAYS", "WORK DAYS"]
# the three totals of the Excel sheet itself (Total Absent / Total Leaves / Total Work days = count of P)
TOTALS = ["TOTAL ABSENT", "TOTAL LEAVES", "TOTAL WORK DAYS"]
TIME_RE = re.compile(r"\d{2}:\d{2}:\d{2}")

MODES_MONTHLY = [
    {"id": "sheet", "title": "Same layout as the Excel sheet (exact copy)", "fixed": True,
     "sub": "Names down the side, two columns per day (status + arrival time), totals at the right, same colours"},
    {"id": "all", "title": "One image: all employees", "sub": "Every employee that has entries this month"},
    {"id": "leave", "title": "Only employees with leave / absence", "sub": "Leaves, half days or absences"},
    {"id": "late", "title": "Late arrivals list", "sub": "One line per late arrival (uses the late threshold)"},
]
MODES_BIO = [
    {"id": "all", "title": "One image: everyone who checked in", "sub": "Your chosen columns"},
    {"id": "late", "title": "Late arrivals only", "sub": "Checked in after the late threshold"},
]


# ---------------------------------------------------------------- helpers
def normalize_time(text):
    """'8.08 am', '8:15', '08:15:00', '8.00am' -> 'HH:MM:SS'. None if it is not a time."""
    if isinstance(text, (datetime.time, datetime.datetime)):
        return text.strftime("%H:%M:%S")
    t = str(text or "").strip().upper().replace(".", ":")
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


def _secs(t):
    h, m, s = (int(x) for x in t.split(":"))
    return h * 3600 + m * 60 + s


def _late_secs(late_after):
    return _secs(normalize_time(late_after) or "08:15:00")


def _num(x):
    return str(int(x)) if float(x).is_integer() else str(x)


def _theme_colors(wb):
    xml = getattr(wb, "loaded_theme", None) or b""
    xml = xml.decode("utf-8", "ignore") if isinstance(xml, bytes) else str(xml)
    out = []
    for n in ["lt1", "dk1", "lt2", "dk2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6"]:
        m = re.search(rf"<a:{n}>.*?(?:val|lastClr)=\"([0-9A-Fa-f]{{6}})\"", xml, re.S)
        out.append(m.group(1).upper() if m else "FFFFFF")
    return out


def _hex(color, theme):
    """openpyxl colour (rgb / theme+tint) -> 'RRGGBB' or None."""
    import colorsys
    try:
        if color.type == "rgb" and isinstance(color.rgb, str):
            return color.rgb[-6:].upper()
        if color.type == "theme":
            base = theme[color.theme]
            r, g, b = (int(base[i:i + 2], 16) / 255 for i in (0, 2, 4))
            h, l, sat = colorsys.rgb_to_hls(r, g, b)
            t = color.tint or 0
            l = l * (1 + t) if t < 0 else l * (1 - t) + t
            r, g, b = colorsys.hls_to_rgb(h, l, sat)
            return "%02X%02X%02X" % (round(r * 255), round(g * 255), round(b * 255))
    except Exception:
        pass
    return None


def _fill_of(cell, theme):
    """Solid fill colour of a cell as '#RRGGBB' (white counts as no fill)."""
    try:
        if cell.fill and cell.fill.fill_type == "solid":
            h = _hex(cell.fill.fgColor, theme)
            return None if h in (None, "FFFFFF") else "#" + h
    except Exception:
        pass
    return None


def _col_hidden(ws, c):
    return any(v.hidden and v.min is not None and v.min <= c <= (v.max or v.min) for v in ws.column_dimensions.values())


def _is_monthly(ws):
    b1 = ws.cell(1, 2).value
    if not (isinstance(b1, str) and b1.strip().lower() == "name"):
        return False
    return sum(1 for c in range(3, ws.max_column + 1) if isinstance(ws.cell(1, c).value, datetime.datetime)) >= 5


def _is_bio(ws):
    for r in range(1, 8):
        vals = [str(ws.cell(r, c).value or "").strip().lower() for c in range(1, 8)]
        if "punch state" in vals and "employee id" in vals:
            return r
    return None


# ---------------------------------------------------------------- interface
def detect(path):
    try:
        wb = openpyxl.load_workbook(path, data_only=True)
        return any(_is_monthly(ws) or _is_bio(ws) for ws in wb.worksheets)
    except Exception:
        return False


def load(path, sheet=None, late_after="08:15"):
    wb = openpyxl.load_workbook(path, data_only=True)
    monthly = [ws.title for ws in wb.worksheets if _is_monthly(ws)]
    if monthly:
        name = sheet if sheet in monthly else monthly[-1]
        return _load_monthly(wb, wb[name], monthly, late_after)
    for ws in wb.worksheets:
        hr = _is_bio(ws)
        if hr:
            return _load_bio(ws, hr, late_after)
    raise ValueError("This does not look like a staff monthly sheet or a biometric export.")


# ---------------------------------------------------------------- monthly sheet
def _load_monthly(wb, ws, sheets, late_after):
    theme = _theme_colors(wb)
    first = next(ws.cell(1, c).value for c in range(3, ws.max_column + 1) if isinstance(ws.cell(1, c).value, datetime.datetime))
    month = next((v for k, v in MONTHS.items() if ws.title.strip().lower().startswith(k)), first.month)
    year = first.year
    notes, days, wrong_month = [], [], 0
    for c in range(3, ws.max_column + 1):
        v = ws.cell(1, c).value
        if not isinstance(v, datetime.datetime):
            continue
        try:
            d = datetime.date(year, month, v.day)
        except ValueError:
            continue
        if v.month != month:
            wrong_month += 1
        has_t = c + 1 <= ws.max_column and ws.cell(1, c + 1).value is None
        n = v.day
        days.append({"n": n, "d": f"D{n:02d}", "t": f"T{n:02d}", "sc": c, "tc": c + 1 if has_t else None,
                     "iso": d.isoformat(), "wd": d.strftime("%a"), "hidden": _col_hidden(ws, c)})
    month_label = datetime.date(year, month, 1).strftime("%B %Y").upper()
    if wrong_month:
        notes.append(f"{wrong_month} date headers named a different month; they were read as {month_label.title()} using the sheet name.")

    columns = [{"label": "NO", "header": "NO", "display": "No."}, {"label": "NAME", "header": "NAME", "display": "Name"},
               {"label": "SECTION", "header": "SECTION", "display": "Section"}]
    columns += [{"label": s, "header": s, "display": s.title()} for s in SUMMARY]
    columns += [{"label": s, "header": s.title(), "display": s.title()} for s in TOTALS]
    columns += [{"label": d["d"], "header": str(d["n"]), "display": f"Day {d['n']} ({d['wd']}) status"} for d in days]
    columns += [{"label": d["t"], "header": f"T{d['n']}", "display": f"Day {d['n']} arrival time"} for d in days]

    records, issues, section = [], [], ""
    vacant = norm_status = moved = 0
    sheet_rows = []                                   # source rows in order, with their fills (for the exact-copy output)

    def row_fills(r):
        f = {}
        for d in days:
            fs = _fill_of(ws.cell(r, d["sc"]), theme)
            ft = _fill_of(ws.cell(r, d["tc"]), theme) if d["tc"] else None
            if fs or ft:
                f[str(d["n"])] = [fs, ft]
        return {"h": ws.row_dimensions[r].height, "hidden": bool(ws.row_dimensions[r].hidden), "a": _fill_of(ws.cell(r, 1), theme),
                "b": _fill_of(ws.cell(r, 2), theme), "f": f}

    for r in range(2, ws.max_row + 1):
        a, nm = ws.cell(r, 1).value, ws.cell(r, 2).value
        if nm is None or not str(nm).strip():
            if isinstance(a, str) and len(a.strip()) > 3:
                section = a.strip()
                end = next((m.max_col for m in ws.merged_cells.ranges if m.min_row == r == m.max_row and m.min_col == 1), None)
                sheet_rows.append({"kind": "section", "text": section, "h": ws.row_dimensions[r].height,
                                   "hidden": bool(ws.row_dimensions[r].hidden), "end_col": end})
            continue
        nm = str(nm).strip()
        if "vacant" in nm.lower():
            vacant += 1
            sheet_rows.append({"kind": "vacant", "no": "" if a is None else str(a).strip(), "name": nm, **row_fills(r)})
            continue
        rec = {"NO": "" if a is None else str(a).strip(), "NAME": nm, "SECTION": section, "_row": r}
        idx = len(records)
        for d in days:
            s_raw = ws.cell(r, d["sc"]).value
            t_raw = ws.cell(r, d["tc"]).value if d["tc"] else None
            s = "" if s_raw is None else str(s_raw).strip()
            t = "" if t_raw is None else (t_raw.strftime("%H:%M:%S") if isinstance(t_raw, (datetime.time, datetime.datetime)) else str(t_raw).strip())
            status, tm = "", ""
            if s:
                key = s.upper()
                if key in STATUS_MAP:
                    status = STATUS_MAP[key]
                    norm_status += 1 if s != status else 0
                elif normalize_time(s):                      # a time typed in the status cell
                    status, tm, moved = "P", normalize_time(s), moved + 1
                else:
                    status = s                               # unknown -> flagged below
                    guess = "P" if key.startswith("P") and len(key) <= 5 else None
                    issues.append({"id": f"{idx}-{d['d']}", "index": idx, "row": r, "field": d["d"], "who": nm,
                                   "kind": "choice", "message": f"Unrecognised status '{s}' on {d['iso']}",
                                   "raw": s, "suggest": guess, "options": [o for o in STATUS_OPTIONS],
                                   "severity": "auto" if guess else "high"})
            if t and not tm:
                n_t = normalize_time(t)
                if n_t:
                    tm = n_t
                    norm_status += 1 if t != n_t else 0
                else:
                    low = t.lower()
                    if not status and "visit" in low:
                        status = "V"
                    elif not status and "leave" in low:
                        status, moved = "L", moved + 1
            rec[d["d"]], rec[d["t"]] = status, tm
        rec["_skip"] = not any(rec[d["d"]] for d in days)
        _summarize(rec, days, _late_secs(late_after))
        records.append(rec)
        sheet_rows.append({"kind": "person", "idx": idx, **row_fills(r)})

    hidden = sum(1 for x in records if x["_skip"])
    if norm_status:
        notes.append(f"{norm_status} entries were tidied (e.g. p -> P, 8.08 am -> 08:08:00).")
    if moved:
        notes.append(f"{moved} entries typed in the wrong column were moved (a time in the status cell, or 'Sick Leave' in the time cell).")
    n_hr = sum(1 for x in sheet_rows if x.get("hidden"))
    hd_days = [d["n"] for d in days if d["hidden"]]
    if n_hr or hd_days:
        notes.append(f"Your Excel sheet hides {n_hr} row(s)" + (f" and the date column(s) for day {', '.join(map(str, hd_days))}" if hd_days else "")
                     + ". The exact-copy output hides them too (you can switch them on in Configure).")
    if vacant or hidden:
        notes.append(f"{vacant + hidden} rows with no entries (vacant posts / new joiners) are hidden from the output.")

    shown = [x for x in records if not x["_skip"]]
    late_total = sum(int(x["LATE DAYS"]) for x in shown)
    leave_total = sum(float(x["LEAVES"]) for x in shown)
    return {
        "module": "employee", "kind": "monthly", "kind_label": "Employee monthly sheet",
        "sheets": sheets, "sheet": ws.title, "columns": columns, "records": records,
        "keys": {"label": "NAME", "terr": "NAME", "in": None, "out": None},
        "date": datetime.date(year, month, 1).isoformat(), "date_label": month_label.title(),
        "month_label": month_label, "date_token": f"{year}{month:02d}",
        "issues": issues, "notes": notes, "days": days,
        "status_cols": [d["d"] for d in days], "status_options": STATUS_OPTIONS,
        "readonly": SUMMARY + TOTALS,
        "sheet": {"name_fill": _fill_of(ws["B1"], theme) or "#AFABAB", "a_fill": _fill_of(ws["A1"], theme) or "#AFABAB",
                  "date_fill": _fill_of(ws.cell(1, days[0]["sc"]), theme) or "#A9D18E", "rows": sheet_rows,
                  "totals_hidden": any(_col_hidden(ws, c) for c in range(3, ws.max_column + 1)
                                       if str(ws.cell(1, c).value or "").strip().lower().startswith("total")),
                  "n_hidden_rows": sum(1 for x in sheet_rows if x.get("hidden")),
                  "hidden_days": [d["n"] for d in days if d["hidden"]]},
        "modes": MODES_MONTHLY, "default_mode": "sheet",
        "sorts": [{"id": "excel", "title": "Same order as Excel"}, {"id": "name", "title": "Name A-Z"},
                  {"id": "section", "title": "Section"}],
        "presets": [
            {"name": "Summary", "columns": ["NAME", "PRESENT", "LEAVES", "ABSENT", "LATE DAYS", "WORK DAYS"]},
            {"name": "Full summary", "columns": ["NO", "NAME", "SECTION"] + SUMMARY},
            {"name": "Monthly grid", "columns": ["NAME"] + [d["d"] for d in days] + ["LEAVES", "WORK DAYS"]},
        ],
        "default_columns": ["NAME", "PRESENT", "LEAVES", "ABSENT", "LATE DAYS", "WORK DAYS"],
        "default_template": "emp-sheet", "grid_template": "emp-grid",
        "review_cols": ["NO", "SECTION", "LEAVES", "LATE DAYS", "WORK DAYS"],
        "preview_cols": ["NAME", "SECTION", "PRESENT", "LEAVES", "WORK DAYS"],
        "stat_cards": [
            {"l": "Employees", "v": len(shown), "s": f"with entries in {month_label.title()}"},
            {"l": "Days in sheet", "v": len(days), "s": "columns read"},
            {"l": "Leave days", "v": _num(leave_total), "s": "marked L"},
            {"l": "Late arrivals", "v": late_total, "s": f"after {late_after}"},
        ],
        "stats": {"total": len(shown), "issues": len(issues)},
    }


def _summarize(rec, days, late_s):
    c = Counter(rec.get(d["d"], "") for d in days)
    late = sum(1 for d in days if rec.get(d["d"]) == "P" and TIME_RE.fullmatch(rec.get(d["t"], ""))
               and _secs(rec[d["t"]]) > late_s)
    rec["PRESENT"] = _num(c["P"] + c["V"])
    rec["LEAVES"] = _num(c["L"])
    rec["HOLIDAYS"] = _num(c["H"])
    rec["HALF DAYS"] = _num(c["HD"])
    rec["VISITS"] = _num(c["V"])
    rec["ABSENT"] = _num(c["Ab"])
    rec["LATE DAYS"] = _num(late)
    rec["WORK DAYS"] = _num(c["P"] + c["V"] + 0.5 * c["HD"])
    rec["TOTAL ABSENT"] = _num(c["Ab"])
    rec["TOTAL LEAVES"] = _num(c["L"])
    rec["TOTAL WORK DAYS"] = _num(c["P"])             # same rule as the sheet: COUNTIF(..., "P")


def recalc(data, rows, late_after="08:15"):
    """Totals follow the day cells, so edits to a status or time flow into the summary columns."""
    if data.get("kind") != "monthly":
        return rows
    ls = _late_secs(late_after)
    out = []
    for r in rows:
        r = dict(r)
        _summarize(r, data["days"], ls)
        out.append(r)
    return out


# ---------------------------------------------------------------- biometric export
def _load_bio(ws, hr, late_after):
    head = {str(ws.cell(hr, c).value or "").strip().lower(): c for c in range(1, ws.max_column + 1)}
    date = None
    for r in range(1, hr):
        m = re.search(r"(\d{4}-\d{2}-\d{2})", str(ws.cell(r, 1).value or ""))
        if m:
            date = m.group(1)
    people = {}
    for r in range(hr + 1, ws.max_row + 1):
        eid = ws.cell(r, head["employee id"]).value
        if eid in (None, ""):
            continue
        eid = str(eid).strip()
        t = normalize_time(ws.cell(r, head["time"]).value)
        state = str(ws.cell(r, head["punch state"]).value or "").strip()
        p = people.setdefault(eid, {"name": str(ws.cell(r, head["first name"]).value or "").strip(),
                                    "dept": str(ws.cell(r, head["department"]).value or "").strip(),
                                    "ins": [], "outs": [], "n": 0, "seen": set(), "row": r})
        p["n"] += 1
        if t:
            p["seen"].add((t, state))
            (p["outs"] if "out" in state.lower() else p["ins"]).append(t)
    ls = _late_secs(late_after)
    records, merged_total = [], 0
    for eid, p in people.items():
        merged = p["n"] - len(p["seen"])
        merged_total += merged
        first_in = min(p["ins"]) if p["ins"] else ""
        last = max(p["ins"] + p["outs"]) if (p["ins"] or p["outs"]) else ""
        records.append({"EMPLOYEE ID": eid, "NAME": p["name"], "DEPARTMENT": p["dept"], "FIRST CHECK-IN": first_in,
                        "LAST PUNCH": last, "PUNCHES": str(p["n"]), "DUPLICATES MERGED": str(merged),
                        "LATE": "Yes" if first_in and _secs(first_in) > ls else "No", "_row": p["row"]})
    cols = ["EMPLOYEE ID", "NAME", "DEPARTMENT", "FIRST CHECK-IN", "LAST PUNCH", "PUNCHES", "DUPLICATES MERGED", "LATE"]
    late_n = sum(1 for r in records if r["LATE"] == "Yes")
    notes = []
    if merged_total:
        notes.append(f"{merged_total} duplicate punches were merged (the same person punching several times).")
    return {
        "module": "employee", "kind": "biometric", "kind_label": "Biometric transaction export",
        "sheets": [ws.title], "sheet": ws.title,
        "columns": [{"label": c, "header": c, "display": c.title().replace("Id", "ID")} for c in cols], "records": records,
        "keys": {"label": "NAME", "terr": "NAME", "in": None, "out": None},
        "date": date, "date_label": date or "not found", "month_label": (datetime.date.fromisoformat(date).strftime("%d %B %Y").upper() if date else ""), "date_token": (date or "").replace("-", ""),
        "issues": [], "notes": notes, "days": [], "status_cols": [], "status_options": [], "readonly": [],
        "modes": MODES_BIO, "default_mode": "all",
        "sorts": [{"id": "excel", "title": "Same order as Excel"}, {"id": "name", "title": "Name A-Z"},
                  {"id": "dept", "title": "Department"}, {"id": "time", "title": "Check-in time"}],
        "presets": [{"name": "Check-in list", "columns": ["EMPLOYEE ID", "NAME", "DEPARTMENT", "FIRST CHECK-IN"]},
                    {"name": "Name + time", "columns": ["NAME", "FIRST CHECK-IN"]}],
        "default_columns": ["EMPLOYEE ID", "NAME", "DEPARTMENT", "FIRST CHECK-IN"],
        "default_template": "emp-summary", "grid_template": "emp-summary",
        "review_cols": ["EMPLOYEE ID", "DEPARTMENT", "FIRST CHECK-IN", "LATE"],
        "preview_cols": ["EMPLOYEE ID", "NAME", "DEPARTMENT", "FIRST CHECK-IN"],
        "stat_cards": [
            {"l": "Employees present", "v": len(records), "s": "checked in"},
            {"l": "Late arrivals", "v": late_n, "s": f"after {late_after}"},
            {"l": "Duplicate punches", "v": merged_total, "s": "merged"},
            {"l": "Departments", "v": len({r["DEPARTMENT"] for r in records}), "s": "in the file"},
        ],
        "stats": {"total": len(records), "issues": 0},
    }


# ---------------------------------------------------------------- output tables
def _sorted(rows, sort):
    if sort == "name":
        return sorted(rows, key=lambda r: r.get("NAME", "").lower())
    if sort == "section":
        return sorted(rows, key=lambda r: (r.get("SECTION", "").lower(), r.get("NAME", "").lower()))
    if sort == "dept":
        return sorted(rows, key=lambda r: (r.get("DEPARTMENT", "").lower(), r.get("NAME", "").lower()))
    if sort == "time":
        return sorted(rows, key=lambda r: r.get("FIRST CHECK-IN", "") or "99")
    return list(rows)


def build_tables(data, rows, chosen, mode="all", sort="excel", late_after="08:15", **kw):
    """rows = (possibly edited) records in scope. Returns [(name, headers, table_rows)]."""
    header_of = {c["label"]: c["header"] for c in data["columns"]}
    ls = _late_secs(late_after)
    if data["kind"] == "monthly" and mode == "sheet":
        return [_sheet_table(data, rows, late_after, kw.get("include_empty", True), set(kw.get("hidden") or []), kw.get("sheet_opts") or {})]
    if data["kind"] == "monthly":
        rows = recalc(data, [r for r in rows if not r.get("_skip")], late_after)
        rows = _sorted(rows, sort)
        if mode == "late":
            ev = []
            for r in rows:
                for d in data["days"]:
                    t = r.get(d["t"], "")
                    if r.get(d["d"]) == "P" and TIME_RE.fullmatch(t) and _secs(t) > ls:
                        ev.append((d["iso"], r["NAME"], t, str((_secs(t) - ls) // 60)))
            ev.sort()
            body = [[datetime.date.fromisoformat(i).strftime("%d %b"), n, t, m] for i, n, t, m in ev]
            return [("late_arrivals", ["DATE", "NAME", "ARRIVAL", "MINUTES LATE"], body)] if body else []
        if mode == "leave":
            rows = [r for r in rows if float(r["LEAVES"]) or float(r["ABSENT"]) or float(r["HALF DAYS"])]
        name = "staff_attendance" if mode == "all" else "leaves_absences"
    else:
        rows = _sorted(rows, sort)
        if mode == "late":
            rows = [r for r in rows if r.get("FIRST CHECK-IN") and _secs(r["FIRST CHECK-IN"]) > ls]
            body = [[r["NAME"], r.get("DEPARTMENT", ""), r["FIRST CHECK-IN"], str((_secs(r["FIRST CHECK-IN"]) - ls) // 60)] for r in rows]
            return [("late_arrivals", ["NAME", "DEPARTMENT", "FIRST CHECK-IN", "MINUTES LATE"], body)] if body else []
        name = "staff_checkins"
    if not rows:
        return []
    headers = [header_of[l] for l in chosen]
    return [(name, headers, [[r.get(l, "") for l in chosen] for r in rows])]


# ---------------------------------------------------------------- exact copy of the Excel sheet
def _short_time(t):
    """'08:27:00' -> '8.27 AM' (the way the sheet shows arrival times)."""
    if not TIME_RE.fullmatch(t or ""):
        return t or ""
    h, m, _ = (int(x) for x in t.split(":"))
    return f"{h % 12 or 12}.{m:02d} {'AM' if h < 12 else 'PM'}"


def _sheet_table(data, rows, late_after, include_empty, hidden, opts=None):
    """Layout spec (not a plain table): the staff sheet redrawn the way it looks in Excel.
    The shell draws it - items are {x,y,w,h,text,align,bold,fill,color,size} in points."""
    L = data["sheet"]
    opts = opts or {}
    show_rows = bool(opts.get("rows", False))
    show_days = bool(opts.get("days", False))
    show_tot = bool(opts.get("totals", not L.get("totals_hidden", False)))
    days = [d for d in data["days"] if show_days or not d.get("hidden")]
    by_idx = {r["_i"]: r for r in recalc(data, rows, late_after)}
    extra = [r for k, r in by_idx.items() if isinstance(k, str)]
    pick = []                                        # (layout row, record or None)
    for lr in L["rows"]:
        if lr.get("hidden") and not show_rows:
            continue
        if lr["kind"] == "person":
            rec = by_idx.get(lr["idx"])
            if rec is None and include_empty and lr["idx"] not in hidden and data["records"][lr["idx"]].get("_skip"):
                rec = recalc(data, [data["records"][lr["idx"]]], late_after)[0]
            if rec is not None:
                pick.append((lr, rec))
        elif lr["kind"] == "vacant":
            if include_empty:
                pick.append((lr, None))
        else:
            pick.append((lr, None))
    keep, buf = [], []                               # drop a section heading when nobody under it is included
    for lr, rec in pick:
        if lr["kind"] == "section":
            if buf and any(x[0]["kind"] == "person" for x in buf):
                keep += buf
            elif buf:
                keep += [x for x in buf if x[0]["kind"] != "section"]
            buf = [(lr, rec)]
        else:
            buf.append((lr, rec))
    keep += buf if any(x[0]["kind"] != "section" for x in buf) else []
    keep += [({"kind": "person", "idx": None, "h": None, "a": None, "b": None, "f": {}}, r) for r in extra]

    names = [rec["NAME"] for lr, rec in keep if rec] + [lr["name"] for lr, _ in keep if lr["kind"] == "vacant"]
    w_no, w_name = 24, max(90, int(max([len(n) for n in names] + [6]) * 5.6) + 16)
    w_s, w_t, w_tot = 22, 44, 54
    cols, x = [], w_no + w_name
    for d in days:
        wt = w_t if d["tc"] else 0
        cols.append((x, w_s if wt else 42, wt)); x += (w_s if wt else 42) + wt
    tot_x = x
    W = tot_x + (3 * w_tot if show_tot else 0)
    items = []

    def it(x, y, w, h, text, align="c", bold=False, fill=None, size=10.5):
        items.append({"x": x + 1.5, "y": y + 1.5, "w": w, "h": h, "text": text, "align": align, "bold": bold,
                      "fill": fill, "color": "#000000", "size": size})

    y = 0
    hh = 32
    it(0, y, w_no, hh, "", fill=L["a_fill"], bold=True, size=11)
    it(w_no, y, w_name, hh, "Name", bold=True, fill=L["name_fill"], size=11)
    for d, (cx, cw, ct) in zip(days, cols):
        dt = datetime.date.fromisoformat(d["iso"])
        it(cx, y, cw + ct, hh, f"{dt.day}-{dt.strftime('%b')}", fill=L["date_fill"], size=13)
    for i, h in enumerate(("Total\nAbsent", "Total\nLeaves", "Total\nWork days") if show_tot else ()):
        it(tot_x + i * w_tot, y, w_tot, hh, h, bold=True, size=9.5)
    y += hh
    for lr, rec in keep:
        rh = max(lr.get("h") or 16, 16)
        if lr["kind"] == "section":
            end = lr.get("end_col")
            last = max([i for i, d in enumerate(days) if end and d["sc"] <= end], default=None)
            if end is None or last is None:
                it(0, y, W, rh, lr["text"], size=11)
            else:                                    # merged only as far as in the sheet (A..AL), then plain cells
                cx, cw, ct = cols[last]
                it(0, y, cx + cw + ct, rh, lr["text"], size=11)
                for d, (dx, dw, dt) in list(zip(days, cols))[last + 1:]:
                    it(dx, y, dw, rh, "")
                    if dt:
                        it(dx + dw, y, dt, rh, "")
                for i in range(3 if show_tot else 0):
                    it(tot_x + i * w_tot, y, w_tot, rh, "")
        else:
            f = lr.get("f", {})
            if lr["kind"] == "vacant":
                it(0, y, w_no, rh, lr["no"], fill=lr.get("a"))
                it(w_no, y, w_name, rh, lr["name"], align="l", fill=lr.get("b"), size=11)
            else:
                it(0, y, w_no, rh, rec.get("NO", ""), fill=lr.get("a"))
                it(w_no, y, w_name, rh, rec["NAME"], align="l", fill=lr.get("b"), size=11)
            for d, (cx, cw, ct) in zip(days, cols):
                fs, ft = f.get(str(d["n"]), [None, None])
                st = rec.get(d["d"], "") if rec else ""
                tm = _short_time(rec.get(d["t"], "")) if rec else ""
                it(cx, y, cw, rh, st, fill=fs, size=10.5 if len(st) <= 2 else 6.5)
                if ct:
                    it(cx + cw, y, ct, rh, tm, fill=ft, size=10)
            for i, k in enumerate(TOTALS if show_tot else ()):
                it(tot_x + i * w_tot, y, w_tot, rh, rec[k] if rec else "", bold=False, size=10.5)
        y += rh
    people = sum(1 for lr, rec in keep if rec)
    return ("staff_sheet", {"items": items, "width": W + 3, "height": y + 3, "count": people}, None)
