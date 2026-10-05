"""Attendance database (SQLite, one file in %APPDATA%\\LakmeeMuster\\attendance.db).
Every export is saved here (with your edits), so any period can be looked up later:
today, yesterday, this/last week, month, year or a custom range - per rep or per employee.
"""
import datetime
import json
import os
import sqlite3
import time

from . import storage

SCHEMA = """
CREATE TABLE IF NOT EXISTS emp_attendance(
  day TEXT NOT NULL, emp_key TEXT NOT NULL, emp_id TEXT, name TEXT, dept TEXT, status TEXT,
  check_in TEXT, check_out TEXT, source TEXT, saved_at TEXT, PRIMARY KEY(day, emp_key));
CREATE TABLE IF NOT EXISTS rep_attendance(
  day TEXT NOT NULL, rep_key TEXT NOT NULL, territory TEXT, rep_code TEXT, rep_name TEXT, region TEXT, area TEXT,
  check_in TEXT, check_out TEXT, source TEXT, saved_at TEXT, PRIMARY KEY(day, rep_key));
CREATE INDEX IF NOT EXISTS ix_emp_day ON emp_attendance(day);
CREATE INDEX IF NOT EXISTS ix_rep_day ON rep_attendance(day);
"""
PRESETS = [("today", "Today"), ("yesterday", "Yesterday"), ("this_week", "This week"), ("last_week", "Last week"),
           ("this_month", "This month"), ("last_month", "Last month"), ("this_year", "This year"),
           ("last_year", "Last year"), ("all", "All time"), ("custom", "Custom range")]
PRESENT = {"P", "V", "HD"}


def db_path():
    return os.path.join(storage.data_dir(), "attendance.db")


def _con():
    c = sqlite3.connect(db_path())
    c.row_factory = sqlite3.Row
    c.executescript(SCHEMA)
    return c


def resolve_range(preset, start=None, end=None, today=None):
    """Device calendar -> (from_iso, to_iso, label). Weeks run Monday to Sunday."""
    t = today or datetime.date.today()
    d = datetime.date
    if preset == "today":
        a = b = t
    elif preset == "yesterday":
        a = b = t - datetime.timedelta(days=1)
    elif preset in ("this_week", "last_week"):
        a = t - datetime.timedelta(days=t.weekday()) - (datetime.timedelta(days=7) if preset == "last_week" else datetime.timedelta())
        b = a + datetime.timedelta(days=6)
    elif preset == "this_month":
        a = t.replace(day=1)
        b = (a.replace(day=28) + datetime.timedelta(days=4)).replace(day=1) - datetime.timedelta(days=1)
    elif preset == "last_month":
        b = t.replace(day=1) - datetime.timedelta(days=1)
        a = b.replace(day=1)
    elif preset == "this_year":
        a, b = d(t.year, 1, 1), d(t.year, 12, 31)
    elif preset == "last_year":
        a, b = d(t.year - 1, 1, 1), d(t.year - 1, 12, 31)
    elif preset == "all":
        return "0000-01-01", "9999-12-31", "All time"
    else:
        a = d.fromisoformat(start) if start else t
        b = d.fromisoformat(end) if end else a
        if b < a:
            a, b = b, a
    label = dict(PRESETS).get(preset, "Custom range")
    return a.isoformat(), b.isoformat(), label


def _hm(t):
    return (t or "")[:5]


def _secs(t):
    try:
        h, m, *s = (int(x) for x in t.split(":"))
        return h * 3600 + m * 60 + (s[0] if s else 0)
    except Exception:
        return None


# ---------------------------------------------------------------- saving
def save_rows(data, rows, source=""):
    """data = loaded module data, rows = the (edited) records that were exported. Returns counts."""
    now = time.strftime("%Y-%m-%d %H:%M:%S")
    src = os.path.basename(source or "")
    n_emp = n_rep = 0
    with _con() as c:
        if data["module"] == "rep":
            k = data["keys"]
            for r in rows:
                day = (str(r.get("LOGGED IN DATE") or "")[:10]) or data.get("date")
                terr = str(r.get(k["terr"]) or "").strip()
                if not day or not terr or not r.get(k["in"]):
                    continue
                code = str(r.get("SALES REP CODE") or "").strip()
                c.execute("INSERT OR REPLACE INTO rep_attendance VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                          (day, code or terr, terr, code, str(r.get("SALES REP") or ""), str(r.get("REGION") or ""),
                           str(r.get("AREA") or ""), r.get(k["in"]) or "", r.get(k["out"]) or "", src, now))
                n_rep += 1
        else:
            kind = data["kind"]
            for r in rows:
                name = str(r.get("NAME") or "").strip()
                if not name:
                    continue
                if kind == "monthly":
                    for d in data["days"]:
                        st = r.get(d["d"]) or ""
                        if st:
                            n_emp += _put_emp(c, d["iso"], "", name, r.get("SECTION", ""), st, r.get(d["t"], ""), "", src, now)
                elif kind == "timecard":
                    for d in data["days"]:
                        a, b = r.get(d["i"], ""), r.get(d["o"], "")
                        if a or b:
                            n_emp += _put_emp(c, d["iso"], r.get("EMPLOYEE ID", ""), name, r.get("DEPARTMENT", ""), "P", a, b, src, now)
                else:
                    a, b = r.get("FIRST CHECK-IN", ""), r.get("LAST CHECK-OUT", "")
                    if (a or b) and data.get("date"):
                        n_emp += _put_emp(c, data["date"], r.get("EMPLOYEE ID", ""), name, r.get("DEPARTMENT", ""), "P", a, b, src, now)
    return {"employees": n_emp, "reps": n_rep}


def _same_person(c, eid, name):
    """Staff sheets list 'Binusha liyanage' without an ID, the biometric files list 'Binusha' with ID 1750.
    Link them when the first name matches exactly one known employee ID, so a person is counted once."""
    first = (name or "").strip().lower().split(" ")[0]
    if eid:                                              # known ID: fold earlier ID-less rows of the same person into it
        rows = c.execute("SELECT DISTINCT emp_key, name FROM emp_attendance WHERE emp_id='' ").fetchall()
        ids = c.execute("SELECT COUNT(DISTINCT emp_key) FROM emp_attendance WHERE emp_id!='' AND lower(name)=?", (first,)).fetchone()[0]
        for r in rows:
            if (r["name"] or "").strip().lower().split(" ")[0] == first and ids <= 1:
                c.execute("UPDATE OR REPLACE emp_attendance SET emp_key=?, emp_id=?, name=?, dept=CASE WHEN dept='' THEN ? ELSE dept END WHERE emp_key=?",
                          (eid, eid, name, "", r["emp_key"]))
        return eid, name
    hit = c.execute("SELECT DISTINCT emp_key, emp_id, name, dept FROM emp_attendance WHERE emp_id!='' AND lower(name)=?", (first,)).fetchall()
    if len(hit) == 1:
        return hit[0]["emp_id"], hit[0]["name"]
    return "", name


def _put_emp(c, day, eid, name, dept, status, a, b, src, now):
    eid = str(eid or "").strip()
    eid, name = _same_person(c, eid, name)
    c.execute("INSERT OR REPLACE INTO emp_attendance VALUES(?,?,?,?,?,?,?,?,?,?)",
              (day, eid or name.lower(), eid, name, dept or "", status, a or "", b or "", src, now))
    return 1


# ---------------------------------------------------------------- reading
def stats():
    with _con() as c:
        e = c.execute("SELECT COUNT(*) n, MIN(day) a, MAX(day) b, COUNT(DISTINCT emp_key) p FROM emp_attendance").fetchone()
        r = c.execute("SELECT COUNT(*) n, MIN(day) a, MAX(day) b, COUNT(DISTINCT rep_key) p FROM rep_attendance").fetchone()
    size = os.path.getsize(db_path()) if os.path.exists(db_path()) else 0
    return {"path": db_path(), "size": size, "today": datetime.date.today().isoformat(),
            "employee": dict(e), "rep": dict(r), "presets": [{"id": i, "label": l} for i, l in PRESETS]}


def people(kind):
    with _con() as c:
        if kind == "rep":
            q = c.execute("SELECT rep_key k, MAX(territory) t, MAX(rep_name) n, MAX(region) g FROM rep_attendance GROUP BY rep_key ORDER BY t")
            return [{"key": x["k"], "label": f"{x['t']}" + (f" - {x['n']}" if x["n"] else ""), "group": x["g"]} for x in q]
        q = c.execute("SELECT emp_key k, MAX(emp_id) i, MAX(name) n, MAX(dept) d FROM emp_attendance GROUP BY emp_key ORDER BY n")
        return [{"key": x["k"], "label": (f"{x['i']} - " if x["i"] else "") + x["n"], "group": x["d"]} for x in q]


def query(p, late_after="08:15"):
    kind = p.get("kind", "employee")
    a, b, label = resolve_range(p.get("preset", "today"), p.get("start"), p.get("end"))
    keys = [k for k in (p.get("people") or []) if k]
    group = (p.get("group") or "").strip()
    q = (p.get("q") or "").strip().lower()
    with _con() as c:
        if kind == "rep":
            sql, args = "SELECT * FROM rep_attendance WHERE day BETWEEN ? AND ?", [a, b]
            if keys:
                sql += f" AND rep_key IN ({','.join('?' * len(keys))})"; args += keys
            if group:
                sql += " AND region=?"; args.append(group)
            rows = [dict(x) for x in c.execute(sql + " ORDER BY day DESC, territory", args)]
            for r in rows:
                r["who"], r["group"], r["key"] = r["territory"], r["region"], r["rep_key"]
                r["name"] = r["rep_name"]
        else:
            sql, args = "SELECT * FROM emp_attendance WHERE day BETWEEN ? AND ?", [a, b]
            if keys:
                sql += f" AND emp_key IN ({','.join('?' * len(keys))})"; args += keys
            if group:
                sql += " AND dept=?"; args.append(group)
            rows = [dict(x) for x in c.execute(sql + " ORDER BY day DESC, name", args)]
            for r in rows:
                r["who"], r["group"], r["key"] = r["name"], r["dept"], r["emp_key"]
    if q:
        rows = [r for r in rows if q in (r["who"] or "").lower() or q in (r.get("name") or "").lower() or q in (r.get("emp_id") or r.get("rep_code") or "").lower()]
    ls = _secs(late_after + ":00") if len(late_after) == 5 else _secs(late_after)
    summ = {}
    for r in rows:
        s = summ.setdefault(r["key"], {"key": r["key"], "who": r["who"], "id": r.get("emp_id") or r.get("rep_code") or "",
                                       "group": r["group"], "days": 0, "present": 0, "leave": 0, "absent": 0, "half": 0,
                                       "late": 0, "no_out": 0, "_ins": [], "first": r["day"], "last": r["day"]})
        s["days"] += 1
        st = r.get("status") or ("P" if r.get("check_in") else "")
        s["present"] += 1 if st in PRESENT else 0
        s["leave"] += 1 if st == "L" else 0
        s["absent"] += 1 if st == "Ab" else 0
        s["half"] += 1 if st == "HD" else 0
        t = _secs(r.get("check_in") or "")
        if t is not None:
            s["_ins"].append(t)
            if kind != "rep" and ls is not None and t > ls and st in PRESENT:
                s["late"] += 1
        if kind == "rep" and r.get("check_in") and not r.get("check_out"):
            s["no_out"] += 1
        s["first"], s["last"] = min(s["first"], r["day"]), max(s["last"], r["day"])
    out = []
    for s in summ.values():
        ins = s.pop("_ins")
        avg = sum(ins) // len(ins) if ins else None
        s["avg_in"] = f"{avg // 3600:02d}:{avg % 3600 // 60:02d}" if avg is not None else ""
        out.append(s)
    out.sort(key=lambda s: (s["who"] or "").lower())
    day_set = {r["day"] for r in rows}
    k = {"records": len(rows), "people": len(out), "days": len(day_set), "late": sum(s["late"] for s in out),
         "present": sum(s["present"] for s in out), "no_out": sum(s["no_out"] for s in out)}
    for r in rows:
        r["check_in"], r["check_out"] = _hm(r.get("check_in")), _hm(r.get("check_out"))
    return {"ok": True, "kind": kind, "from": a, "to": b, "label": label, "kpi": k, "summary": out,
            "records": rows[:6000], "truncated": len(rows) > 6000}


def delete_range(kind, start, end):
    with _con() as c:
        t = "rep_attendance" if kind == "rep" else "emp_attendance"
        n = c.execute(f"DELETE FROM {t} WHERE day BETWEEN ? AND ?", (start, end)).rowcount
    return n
