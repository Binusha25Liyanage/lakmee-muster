"""Writes the Excel (.xlsx) outputs. Looks are copied from the example files:
  style "daily"  - Transaction_YYYY_MM_DD.xlsx   (title row, date row, header row, banded list)
  style "weekly" - Attendance_WeekN_...xlsx      (title, day group row, Check in / Check out columns)
A workbook can hold several sheets (the monthly output = one sheet per week).
"""
import re

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

THIN = Side(style="thin", color="CBBFAE")


def _fill(hexcode):
    return PatternFill("solid", start_color="FF" + hexcode, end_color="FF" + hexcode)


def _sheet_name(name, used):
    n = re.sub(r"[\\/*?:\[\]]", "_", name)[:31] or "Sheet"
    base, i = n, 2
    while n.lower() in used:
        n = f"{base[:28]}_{i}"; i += 1
    used.add(n.lower())
    return n


def write_workbook(path, sheets):
    wb = Workbook()
    wb.remove(wb.active)
    used = set()
    for spec in sheets:
        ws = wb.create_sheet(_sheet_name(spec["name"], used))
        (_daily if spec["style"] == "daily" else _weekly)(ws, spec)
    wb.save(path)
    return path


def _box():
    return Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def _widths(ws, spec):
    for c, w in spec["widths"].items():
        ws.column_dimensions[get_column_letter(c)].width = w


def _body(ws, spec, first_row):
    ncol = len(spec["headers"])
    for i, row in enumerate(spec["rows"]):
        r = first_row + i
        banded = i % 2 == spec["band"]
        for c in range(ncol):
            v = row[c] if c < len(row) else None
            cell = ws.cell(r, c + 1, v if v not in ("",) else None)
            cell.font = Font(name="Calibri", size=11)
            cell.alignment = Alignment(horizontal="left" if spec["aligns"][c] == "l" else "center", vertical="center")
            cell.border = _box()
            if banded:
                cell.fill = _fill(spec["band_color"])


def _daily(ws, spec):
    n = len(spec["headers"])
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=n)
    t = ws.cell(1, 1, spec["title"])
    t.font = Font(size=14, bold=True, color="FFFFFFFF"); t.fill = _fill(spec["head_fill"])
    t.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 24
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=n)
    d = ws.cell(2, 1, spec["subtitle"]); d.font = Font(bold=True); d.alignment = Alignment(horizontal="left")
    for c, h in enumerate(spec["headers"], start=1):
        cell = ws.cell(3, c, h)
        cell.font = Font(bold=True, color="FFFFFFFF"); cell.fill = _fill(spec["head_fill"])
        cell.alignment = Alignment(horizontal="left", vertical="center"); cell.border = _box()
    _body(ws, spec, 4)
    _widths(ws, spec)


def _weekly(ws, spec):
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=spec["title_cols"])
    t = ws.cell(1, 1, spec["title"])
    t.font = Font(size=13, bold=True, color="FFFFFFFF"); t.fill = _fill(spec["head_fill"])
    t.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 22
    for text, c1, c2 in spec["group"]:
        ws.merge_cells(start_row=2, start_column=c1, end_row=2, end_column=c2)
        g = ws.cell(2, c1, text)
        g.font = Font(bold=True, color="FFFFFFFF"); g.fill = _fill(spec["head_fill"])
        g.alignment = Alignment(horizontal="center", vertical="center")
    for c, h in enumerate(spec["headers"], start=1):
        cell = ws.cell(3, c, h)
        cell.font = Font(bold=True); cell.fill = _fill("F0EDE9")
        cell.alignment = Alignment(horizontal="center", vertical="center"); cell.border = _box()
    _body(ws, spec, 4)
    _widths(ws, spec)
