# Lakmee Muster - Status Note (checkpoint 4, app v1.2.0)

Use this file to resume the build in a new chat: upload this ZIP, this note, the Stitch screenshots and the sample Excel files.

## 1. Project in one paragraph
Desktop app "Lakmee Muster" for Lakmee Holdings attendance. PyWebView window (frameless) + React UI, Python backend.
Two independent modules (rep, employee). Output = cropped PNG image(s) + PDF. The user can edit times/names before export
and change output looks with templates. The user (Binusha) runs it on Windows, Python 3.14, VS Code.

## 2. Decisions made
- App name Lakmee Muster, repo lakmee-muster, uploaded Lakmee Holdings logo.
- Theme: maroon #800020 title bar/buttons, black #0D0D0D left nav, dark ash #2E2E30, cream #F5EFE0. UI follows the 10 Stitch screens.
- Scope options: rep-wise, all reps, employee-wise, all employees (cards enabled for the module of the loaded file).
- Rep output: two images (not logged out / logged out) + PDF in THREE independent folders. Default look = original image.
- Stitch elements with made-up data (peak-day %, telemetry, regional coverage, WhatsApp/Telegram send, bell) intentionally not built.
- Employee rules: late = arrival after 08:15 (setting); monthly sheet: P+V count as present, HD = half day, totals recalculated from the day cells.
- Employee data handling: month taken from the sheet name (header dates in the Septhember sheet carry wrong months); text times such as "8.08 am" and p/P tidied
  automatically; unknown status words ("Pending", "Last date") are flagged in Review & Fix; vacant posts and rows with no entries are hidden.

## 3. Structure
main.py, core/api.py, core/renderer.py, core/storage.py, modules/rep_attendance.py, modules/employee_attendance.py,
ui/src (React), ui/dist (built). Rebuild UI: cd ui && npm install && npm run build.
Module interface: MODULE_INFO, detect(path), load(path, sheet, late_after), build_tables(data, rows, chosen, mode, sort, late_after), recalc(...)

## 4. Done and tested (headless Chromium against the real Python backend, real files)
- Rep flow: 32 reps (11 not logged out / 21 logged out), edits, export to 3 folders, history.
- Employee monthly sheet (Septhember): 19 employees, 30 days, unknown-status issues fixed in Review, summary / full / monthly-grid layouts,
  late list (21 entries), leave/absence list (12), totals follow edits (changing a day to L moves PRESENT 24 -> 23, LEAVES 0 -> 1).
- Biometric export: 8 employees, duplicate punches merged, check-in list, late-only mode (correctly empty: nobody after 08:15).
- Templates: gallery, editor with live preview, upload (.json) works, default per module, export.
- Settings > Modules: update from file + restore previous version (tested at backend level).
- Dashboard, Export History, Settings, Help; employee calendar grid view.

## 4b. Added in checkpoint 4: exact copy of the Excel sheet (employee monthly sheet)
- New employee mode "Same layout as the Excel sheet (exact copy)" (default for monthly files), template emp-sheet.
- Redraws the sheet: A/Name header (grey), green date headers over two columns per day, status + arrival time ("8.27 AM"),
  fills copied from the sheet (green Sundays, yellow/red/gold blocks), section row merged like the sheet, Total Absent / Leaves / Work days (count of P, like the sheet's COUNTIF).
- Follows what the sheet hides (5 rows, day-30 column, totals) with checkboxes in Configure to show them. Dates use the sheet name's month (September), not the wrong "Aug" headers.
- Edit step shows the day grid (status dropdowns + times) in this mode; totals follow edits. Fixed a crash when editing a status cell.
- Tested in headless Chromium and compared against LibreOffice's rendering of the original sheet.
- Open question for the user: do they also want an Excel (.xlsx) file in this same structure as output (not only image/PDF)?

## 5. Not built / not done
1. Packaging as an installer / .exe.
2. Employee outputs other than the exact copy (Staff Summary, Staff Monthly Grid, late list) are my own layouts. The exact copy follows the user's Excel sheet.
3. Template editor does not yet edit column widths per column (columns auto-size to content).
4. Stitch extras left out on purpose (see section 2).

## 6. Not tested / risks
- PyWebView window on Windows: frameless title bar buttons, file/folder dialogs, drag-and-drop of Excel files (uses pywebviewFullPath), window resize, module update file dialog.
- Saved name corrections were not clicked through the UI end to end; Find & replace and Bulk edit not clicked through.
- Other sheets in the staff workbook (July, Augest) load but were only checked for structure, not visually.

## 7. Next steps
1. User runs python main.py on Windows and reports errors (screenshot or error text).
2. User sends example images of the wanted employee output; adjust templates/layouts to match.
3. Installer / .exe packaging.
