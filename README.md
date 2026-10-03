# Lakmee Muster - Attendance Management System

Desktop app (PyWebView window + React UI) for Lakmee Holdings attendance.
Turns Excel exports into cropped PNG images and a PDF, with an edit step before export.

## What it reads
- SFA rep attendance export (territory, logged in / logged out)
- Monthly employee sheet (P, Ab, L, H, Half-day, Visit + arrival times, one sheet per month)
- Biometric transaction export (Employee ID, name, department, time, punch state)

## The flow
Import > Review & Fix > Select Scope > Configure > Edit > Preview & Save
- Scope: all reps / rep-wise, all employees / employee-wise
- Edit: double-click cells, undo/redo, add/hide rows, find & replace, bulk edit, saved name corrections, edit log
- Output: PNG image(s) + PDF, saved into three separate folders, remembered between runs
- Employee monthly sheet: "Same layout as the Excel sheet (exact copy)" output - names down the side, two columns per day, the sheet's colours and row order, optional Total columns
- Output Templates: built-in looks, editor with live preview, upload/export template files (.json), default per module
- Settings > Modules: update one module from a file (previous version kept as a backup)

## Run
    python -m pip install -r requirements.txt
    python main.py            (or double-click run.bat)

## Structure
    main.py                          window + startup
    core/api.py                      bridge the UI calls (window.pywebview.api)
    core/renderer.py                 template-driven PNG + PDF drawing
    core/storage.py                  settings, history, corrections, templates  (saved in %APPDATA%\LakmeeMuster)
    modules/rep_attendance.py        independent REP module
    modules/employee_attendance.py   independent EMPLOYEE module
    ui/src/                          React source
    ui/dist/                         built UI (what the app loads; no Node needed to run)

## Change the UI later (needs Node.js)
    cd ui
    npm install
    npm run build

## Update one module only
Settings > Modules > "Update from file...", or replace the file in `modules/`.
A module must define MODULE_INFO, detect, load and build_tables (see the existing files).
Only load module files you trust: they run as code on the PC.

## Template file format (.json)
    {"name": "My look", "title": "LOGGED IN DATE {date}", "header_fill": "#2E2E30", "zebra": true}
Any field you leave out takes the default. Use the editor on the Output Templates screen and the export button to see every field.
