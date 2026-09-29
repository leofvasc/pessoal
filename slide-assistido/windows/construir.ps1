# Monta o instalador do Slide Assistido para Windows (64 bits).
# Uso, em uma máquina Windows com Python 3.12 e Inno Setup 6: powershell -ExecutionPolicy Bypass -File windows\construir.ps1
$ErrorActionPreference = "Stop"
$PythonVersion = "3.12.10"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Project = Split-Path -Parent $Here
$Build = Join-Path $Here "build"
$Stage = Join-Path $Build "stage"
$Python = Join-Path $Stage "python"
$App = Join-Path $Stage "app"

if (Test-Path $Build) { Remove-Item $Build -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Python, $App | Out-Null

# 1. Python embutido: o usuário não precisa instalar Python.
$Zip = Join-Path $Build "python-embed.zip"
Invoke-WebRequest "https://www.python.org/ftp/python/$PythonVersion/python-$PythonVersion-embed-amd64.zip" -OutFile $Zip
Expand-Archive $Zip -DestinationPath $Python
$Pth = Get-ChildItem $Python -Filter "python*._pth" | Select-Object -First 1
Set-Content -Path $Pth.FullName -Encoding ascii -Value @(
  ($Pth.BaseName + ".zip"), ".", "Lib\site-packages", "import site"
)

# 2. Dependências instaladas dentro do programa, com a mesma versão de Python.
$SitePackages = Join-Path $Python "Lib\site-packages"
python -m pip install --disable-pip-version-check --no-warn-script-location --target $SitePackages `
  --extra-index-url https://download.pytorch.org/whl/cpu `
  -r (Join-Path $Here "requisitos.txt")
if ($LASTEXITCODE) { throw "Falha ao instalar as dependências." }

# O PyTorch exige o runtime do Visual C++; a cópia local evita erro em computadores sem o pacote instalado.
foreach ($Dll in "msvcp140.dll", "msvcp140_1.dll", "msvcp140_2.dll", "vcruntime140.dll", "vcruntime140_1.dll", "concrt140.dll", "vcomp140.dll") {
  $Source = Join-Path $env:SystemRoot "System32\$Dll"
  if ((Test-Path $Source) -and -not (Test-Path (Join-Path $Python $Dll))) { Copy-Item $Source $Python }
}

# 3. Arquivos do aplicativo (sem testes, iniciador antigo e dados de uso).
foreach ($Item in "server.py", "index.html", "app.js", "styles.css", "comments.json", "README.md", "LICENSE", "assets") {
  Copy-Item (Join-Path $Project $Item) $App -Recurse
}
# O marcador faz o servidor gravar as apresentações em %LOCALAPPDATA%\SlideAssistido.
Set-Content -Path (Join-Path $App ".instalado") -Value "instalado" -Encoding ascii

# 4. Ícone e instalador.
python -m pip install --disable-pip-version-check --quiet pillow
python -c "from PIL import Image; Image.open(r'$Project\assets\app-icon.png').convert('RGBA').save(r'$Build\app-icon.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])"
if ($LASTEXITCODE) { throw "Falha ao gerar o ícone." }

$Iscc = (Get-Command iscc.exe -ErrorAction SilentlyContinue).Source
if (-not $Iscc) { $Iscc = Join-Path ${env:ProgramFiles(x86)} "Inno Setup 6\ISCC.exe" }
& $Iscc (Join-Path $Here "SlideAssistido.iss")
if ($LASTEXITCODE) { throw "Falha ao compilar o instalador." }
Get-ChildItem (Join-Path $Build "saida")
