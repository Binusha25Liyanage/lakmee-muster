# Lakmee Muster

Attendance management desktop app for **Lakmee Holdings**. Import an attendance Excel export, check and correct it, then download clean images, PDFs or Excel sheets, and keep every export in a searchable database.

Built by the **IT Department of Lakmee Holdings**.

## Features

- **Rep attendance** from the SFA RepAttendance export: cropped PNG images and a PDF, saved to three separate folders
- **Employee attendance** from the monthly staff sheet, the daily biometric export and the monthly Total Time Card
- **Excel downloads**: a daily transaction sheet and one workbook with a sheet for every week of the month
- **Excel layouts**: upload an example `.xlsx` and the app copies its structure, colours and column order
- **Edit before export**: fix times, statuses and names; the original Excel file is never changed
- **Attendance database** (SQLite): every export is saved; filter by today, yesterday, this/last week, month or year, a custom range, and per rep or employee
- **Output templates** to change how images look, no code needed
- Independent rep and employee modules that can be updated separately
- Uses the computer's real-time clock and calendar

## Tech

Python (PyWebView, openpyxl, ReportLab, Pillow, SQLite) with a React interface.

## Run

```bash
python -m pip install -r requirements.txt
python main.py
```

On Windows you can double-click `run.bat`. To build a shareable `.exe` folder, double-click `build_exe.bat`.

## Notes

Attendance files contain names and other personal data. Do not commit real exports or generated files to a public repository.
