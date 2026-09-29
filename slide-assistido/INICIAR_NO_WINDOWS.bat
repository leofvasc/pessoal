@echo off
cd /d "%~dp0"
python -c "import fitz, websockets, sentence_transformers" >nul 2>&1
if errorlevel 1 (
  echo Instalando PDF, transcricao e modelo semantico local. Isso pode demorar...
  python -m pip install --user pymupdf "websockets>=14,<17" sentence-transformers
  if errorlevel 1 (
    echo Nao foi possivel instalar as dependencias. Verifique a conexao com a internet.
    pause
    exit /b 1
  )
)
start "" "http://localhost:4174/?v=10"
python server.py
pause
