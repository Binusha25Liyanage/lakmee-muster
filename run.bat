@echo off
cd /d "%~dp0"
call find_python.bat
if not defined PY (
  echo Python was not found. Install Python from python.org ^(tick "Add python.exe to PATH"^), then run this again.
  pause & exit /b 1
)
echo Using Python: %PY%
%PY% -m pip install -r requirements.txt
%PY% main.py
pause
