@echo off
rem Sets PY to a working Python (ignores the Microsoft Store "python" shortcut). Used by run.bat and build_exe.bat.
set "PY="
where py >nul 2>nul && (py -3 --version >nul 2>nul && set "PY=py -3")
if defined PY goto :eof
python --version >nul 2>nul && set "PY=python"
if defined PY goto :eof
for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python3*" "%ProgramFiles%\Python3*" "%ProgramFiles(x86)%\Python3*") do (
  if exist "%%~D\python.exe" set PY="%%~D\python.exe"
)
