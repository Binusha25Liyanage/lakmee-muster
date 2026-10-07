@echo off
rem Builds "Lakmee Muster.exe" (a folder you can zip and share). Run this on Windows, from this folder.
cd /d "%~dp0"
call find_python.bat
if not defined PY (
  echo Python was not found. Install Python from python.org ^(tick "Add python.exe to PATH"^), then run this again.
  pause & exit /b 1
)
echo Using Python: %PY%
%PY% -m pip install -r requirements.txt
if errorlevel 1 goto failed
%PY% -m pip install -U pyinstaller
if errorlevel 1 goto failed
%PY% -m PyInstaller --noconfirm --clean --windowed --name "Lakmee Muster" ^
  --icon assets\icon.ico ^
  --add-data "ui\dist;ui\dist" --add-data "assets;assets" ^
  --hidden-import modules.rep_attendance --hidden-import modules.employee_attendance ^
  --collect-submodules webview ^
  main.py
if errorlevel 1 goto failed
echo.
echo Self-test of the built app:
start /wait "" "dist\Lakmee Muster\Lakmee Muster.exe" --selftest
type "%APPDATA%\LakmeeMuster\selftest.txt"
echo.
echo DONE. Share the whole folder  dist\Lakmee Muster  (zip it). Start it with "Lakmee Muster.exe".
pause
exit /b 0
:failed
echo.
echo BUILD FAILED - send me the text above.
pause
exit /b 1
