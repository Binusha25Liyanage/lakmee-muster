"""
Employee Attendance module  (independent of every other module)
---------------------------------------------------------------
Milestone 2 will add parsing for:
  * the monthly staff sheet (P / Ab / L / H / Half-day / Visit + arrival times)
  * the daily biometric transaction export (Employee ID, name, department, time, punch state)

It exposes the same interface as modules/rep_attendance.py so the app shell can treat both alike:
    MODULE_INFO, detect(path), load(path), build_tables(...)
"""
import openpyxl

MODULE_INFO = {"id": "employee", "name": "Employee Attendance", "version": "0.1.0-preview"}


def detect(path):
    """True when the file looks like a staff monthly sheet or a biometric transaction export."""
    try:
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        ws = wb.active
        head = " ".join(str(c.value).lower() for row in ws.iter_rows(min_row=1, max_row=6) for c in row if c.value)
        return ("punch state" in head and "employee id" in head) or ("employee" in head and "attendance" in head) \
            or wb.sheetnames[0].lower() in {"july", "august", "septhember", "september"}
    except Exception:
        return False


def load(path):
    raise NotImplementedError("Employee attendance parsing arrives in the next milestone.")


def build_tables(data, rows, chosen, mode="all", sort="excel"):
    raise NotImplementedError("Employee attendance output arrives in the next milestone.")
