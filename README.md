# Lakmee Muster - Attendance Management System

Desktop app (PyWebView window + React UI) for Lakmee Holdings attendance.

## Status: checkpoint 2
Working and tested here on a real SFA RepAttendance export (in a headless browser against the real Python backend):
- Full rep wizard: Import > Review & Fix > Select Scope > Configure > Edit > Preview & Save
- Edit before export: inline cell edit, undo/redo, add/hide rows, find & replace, bulk edit, saved name corrections, edit log
- Two built-in output looks (Classic Grid = original image, Lakmee Maroon Broadcast)
- Three independent save folders (Image 1, Image 2, PDF), remembered between runs
- Dashboard, Export History, Settings, Help

Not built yet (screens exist as "coming next update"): employee module parsing (monthly sheet + biometric export),
Output Templates editor and template upload.

Not tested on Windows: the PyWebView window itself (frameless title bar buttons, file/folder dialogs, drag & drop of files).

## Run
    python -m pip install -r requirements.txt
    python main.py            (or double-click run.bat)

## Structure
    main.py                          window + startup
    core/api.py                      bridge the UI calls (window.pywebview.api)
    core/renderer.py                 template-driven PNG + PDF drawing
    core/storage.py                  settings, history, corrections, templates  (saved in %APPDATA%\LakmeeMuster)
    modules/rep_attendance.py        independent REP module
    modules/employee_attendance.py   independent EMPLOYEE module (stub for now)
    ui/src/                          React source
    ui/dist/                         built UI (what the app loads; no Node needed to run)

## Change the UI later (needs Node.js)
    cd ui
    npm install
    npm run build        (or: npm run watch)

## Update one module only
Replace the file in `modules/` (e.g. `rep_attendance.py`). Nothing else changes.
