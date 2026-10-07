"""Small JSON stores kept in the user's app-data folder (survive app updates)."""
import json
import os
import sys
import time
import uuid


def data_dir():
    if sys.platform == "win32":
        base = os.environ.get("APPDATA") or os.path.expanduser("~")
        p = os.path.join(base, "LakmeeMuster")
    else:
        p = os.path.join(os.path.expanduser("~"), ".lakmee-muster")
    os.makedirs(p, exist_ok=True)
    return p


def _path(name):
    return os.path.join(data_dir(), name)


def _read(name, default):
    try:
        with open(_path(name), "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def _write(name, obj):
    tmp = _path(name) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
    os.replace(tmp, _path(name))


# ---------------------------------------------------------------- settings
DEFAULT_SETTINGS = {
    "img1_folder": "", "img2_folder": "", "pdf_folder": "", "xlsx_folder": "",
    "dpi": 300, "naming": "{Module}_{Scope}_{Date}",
    "date_format": "MM/DD/YYYY", "late_after": "08:15",
    "density": "comfortable",
}


def get_settings():
    return {**DEFAULT_SETTINGS, **_read("settings.json", {})}


def save_settings(patch):
    s = get_settings()
    s.update(patch or {})
    _write("settings.json", s)
    return s


# ---------------------------------------------------------------- history
def get_history():
    return _read("history.json", [])


def add_history(entry):
    h = get_history()
    entry = {"id": uuid.uuid4().hex[:10], "time": time.strftime("%Y-%m-%d %H:%M:%S"), **entry}
    h.insert(0, entry)
    _write("history.json", h[:500])
    return entry


def delete_history(hid):
    h = [e for e in get_history() if e.get("id") != hid]
    _write("history.json", h)
    return h


# ---------------------------------------------------------------- name corrections
def get_corrections():
    return _read("corrections.json", [])


def add_correction(original, corrected, auto=True):
    c = [x for x in get_corrections() if x["original"] != original]
    c.append({"id": uuid.uuid4().hex[:8], "original": original, "corrected": corrected, "auto": bool(auto)})
    _write("corrections.json", c)
    return c


def delete_correction(cid):
    c = [x for x in get_corrections() if x["id"] != cid]
    _write("corrections.json", c)
    return c


def set_correction_auto(cid, auto):
    c = get_corrections()
    for x in c:
        if x["id"] == cid:
            x["auto"] = bool(auto)
    _write("corrections.json", c)
    return c


# ---------------------------------------------------------------- user templates
def get_user_templates():
    return _read("templates.json", [])


def save_user_template(t):
    ts = get_user_templates()
    t = {**t, "builtin": False}
    if not t.get("id") or t["id"].startswith(("classic", "lakmee-maroon")):
        t["id"] = "tpl-" + uuid.uuid4().hex[:6]
    ts = [x for x in ts if x["id"] != t["id"]] + [t]
    _write("templates.json", ts)
    return t


def delete_user_template(tid):
    _write("templates.json", [x for x in get_user_templates() if x["id"] != tid])


# ---------------------------------------------------------------- employee roster
# Everyone the app has seen in an employee file. Used to list employees with no punch on a day (shown with "-").
def _roster():
    r = _read("roster.json", {})
    return {"people": r.get("people", {}), "excluded": r.get("excluded", [])}


def get_roster():
    r = _roster()
    return [{"id": i, "name": p.get("name", ""), "dept": p.get("dept", ""), "excluded": i in r["excluded"]}
            for i, p in sorted(r["people"].items(), key=lambda kv: (len(kv[0]), kv[0]))]


def learn_roster(entries):
    """Adds unseen employees; never overwrites a name the user already has."""
    r = _roster()
    changed = False
    for e in entries or []:
        i = str(e.get("id", "")).strip()
        if i and i not in r["people"]:
            r["people"][i] = {"name": e.get("name", ""), "dept": e.get("dept", "")}
            changed = True
    if changed:
        _write("roster.json", r)
    return changed


def set_roster_excluded(eid, excluded):
    r = _roster()
    ex = set(r["excluded"])
    (ex.add if excluded else ex.discard)(str(eid))
    r["excluded"] = sorted(ex)
    _write("roster.json", r)
    return get_roster()


def add_roster(eid, name, dept):
    r = _roster()
    r["people"][str(eid).strip()] = {"name": name.strip(), "dept": dept.strip()}
    r["excluded"] = [x for x in r["excluded"] if x != str(eid).strip()]
    _write("roster.json", r)
    return get_roster()


def delete_roster(eid):
    r = _roster()
    r["people"].pop(str(eid), None)
    r["excluded"] = [x for x in r["excluded"] if x != str(eid)]
    _write("roster.json", r)
    return get_roster()


# ---------------------------------------------------------------- Excel layout templates (learned from example .xlsx files)
def get_xlsx_templates():
    return _read("xlsx_templates.json", [])


def save_xlsx_template(t):
    ts = [x for x in get_xlsx_templates() if x["id"] != t["id"]]
    ts.append(t)
    _write("xlsx_templates.json", ts)
    return t


def delete_xlsx_template(tid):
    _write("xlsx_templates.json", [x for x in get_xlsx_templates() if x["id"] != tid])
