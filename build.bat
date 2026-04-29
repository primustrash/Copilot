@echo off
REM ============================================================
REM  OpenAI Token Tracker – Windows .exe Build-Skript
REM  Voraussetzungen:  Python 3.10+  +  pip
REM ============================================================

echo [1/4]  Virtuelle Umgebung erstellen ...
python -m venv .venv
call .venv\Scripts\activate.bat

echo [2/4]  Abhaengigkeiten installieren ...
pip install -r requirements.txt
pip install pyinstaller

echo [3/4]  Anwendung bauen ...
pyinstaller ^
    --onefile ^
    --windowed ^
    --name "OpenAI Token Tracker" ^
    --icon NONE ^
    src\main.py

echo [4/4]  Fertig!
echo.
echo  Die fertige .exe liegt in:  dist\OpenAI Token Tracker.exe
echo.
pause
