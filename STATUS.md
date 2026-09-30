# Lakmee Muster - Status Note (checkpoint 2)

Use this file to resume the build in a new chat: upload this ZIP, this note, the Stitch screenshots and the sample Excel files.

## 1. Project in one paragraph
Desktop app "Lakmee Muster" for Lakmee Holdings attendance. PyWebView window (frameless) + React UI, Python backend.
Two independent modules (rep, employee) so each can be updated on its own. Output = cropped PNG image(s) + PDF of attendance tables.
The user must be able to edit times/names before export, and change output layouts (templates) without code changes.
The user (Binusha) runs it on Windows, Python 3.14, VS Code.

## 2. Decisions already made
- App name: Lakmee Muster. Repo name: lakmee-muster. Logo: the uploaded Lakmee Holdings logo (assets in ui/public and assets/icon.ico).
- Theme: maroon #800020 (title bar, buttons), black #0D0D0D (left nav), dark ash #2E2E30, cream #F5EFE0. UI must match the 10 Stitch screens.
- Scope choices during processing: rep-wise, all reps, employee-wise, all employees.
- Rep output: two images (not logged out / logged out) + PDF, saved into THREE independent folders. Default look = original image (white grid, black borders, Calibri, title "LOGGED IN DATE MM/DD/YYYY").
- Edit before export step is part of the wizard (step 5). Source Excel is never modified; edits are stored separately.
- Stitch elements with made-up data (peak-day %, device telemetry, regional coverage, WhatsApp/Telegram send, notification bell) were intentionally NOT built.
- ZIP is generated only when the user asks.

## 3. Structure
main.py                       window + startup (python main.py, or run.bat)
core/api.py                   bridge the UI calls (window.pywebview.api.*)
core/renderer.py              template-driven PNG + PDF drawing (shared)
core/storage.py               settings, history, name corrections, user templates -> %APPDATA%\LakmeeMuster
modules/rep_attendance.py     independent REP module (detect, load, data checks, build_tables)
modules/employee_attendance.py independent EMPLOYEE module - STUB ONLY
ui/src/                       React source (pages: Dashboard, Import, Review, Scope, Configure, Edit, Preview, History, Settings, Simple)
ui/dist/                      built UI (loaded by the app; Node not needed to run)
Rebuild UI: cd ui && npm install && npm run build   (esbuild, no Vite)
Module interface: MODULE_INFO, detect(path), load(path), build_tables(data, rows, chosen, mode, sort)

## 4. Done and tested
Tested in headless Chromium against the real Python backend, using the real rep file (32 reps: 11 not logged out, 21 logged out):
- Wizard: Import > Review & Fix > Select Scope > Configure > Edit > Preview & Save
- Edit: inline edit (time "8.15 AM" -> 08:15:00), undo/redo, live preview update
- Export: 3 files written into 3 folders, history entry saved
- Dashboard, Export History, Settings, Help
Backend also tested headless: load, preview, export, both built-in templates.

## 5. Not built yet
1. Employee module: parse the monthly staff sheet (P, Ab, L, H, Half-day, Visit codes, arrival times, text times like "8.15 AM", mixed case p/P)
   and the daily biometric export (Employee ID, name, department, time, punch state, duplicate punches). Then employee-wise / all-employees screens (calendar grid, summary table, late threshold 08:15) and enabling the two greyed scope cards.
2. Output Templates screen: template cards, editor with live preview, upload template (.json / sample), save as new, set default per module.
3. Employee output examples: user still has to send example images of how employee attendance should look.
4. "Update module from file" / "Check for update" buttons in Settings > Modules.
5. Installer / .exe packaging.

## 6. Not tested / risks
- PyWebView window on Windows: frameless title bar buttons (minimize/maximize/close), file + folder dialogs, drag-and-drop of Excel files (uses pywebviewFullPath), window resizing.
- Review & Fix with messy data (real file has 0 issues), Find & replace and Bulk edit were not clicked through.
- Real sample files to re-check before coding the employee module: Colombo_Staff_Attendance (sheet named like "Septhember") and Transaction_..._export.xlsx.

## 7. Next steps in order
1. User runs the app on Windows and reports any errors (send screenshot/error text).
2. Build employee module + its screens.
3. Build Output Templates editor + template upload.
4. Module update buttons, final README, packaging.
