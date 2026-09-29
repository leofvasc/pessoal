; Instalador do Slide Assistido. Compilado por construir.ps1, que prepara a pasta build\stage.
#define AppName "Slide Assistido"
#define AppVersion "0.11.0"

[Setup]
AppId={{6F1D3C2A-8B4E-4C7A-9E51-2A7D0B6C4F11}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} (protótipo, versão 11)
AppPublisher=Leonardo Vasconcelos
DefaultDirName={localappdata}\Programs\SlideAssistido
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
; Instalação por usuário: não exige senha de administrador.
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir=build\saida
OutputBaseFilename=SlideAssistido-Instalador-v11
SetupIconFile=build\app-icon.ico
UninstallDisplayIcon={app}\app-icon.ico
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
; Fecha o servidor em execução antes de atualizar ou desinstalar.
CloseApplications=force
RestartApplications=no

[Languages]
Name: "ptbr"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na área de trabalho"; GroupDescription: "Atalhos:"

[InstallDelete]
; Remove dependências de versões anteriores antes de copiar as novas.
Type: filesandordirs; Name: "{app}\python"

[Files]
Source: "build\stage\python\*"; DestDir: "{app}\python"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "build\stage\app\*"; DestDir: "{app}\app"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "build\app-icon.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\python\python.exe"; Parameters: """{app}\app\server.py"""; WorkingDir: "{app}\app"; IconFilename: "{app}\app-icon.ico"; Comment: "Abre o Slide Assistido no navegador"
Name: "{group}\Pasta das apresentações"; Filename: "{localappdata}\SlideAssistido\user_data"
Name: "{group}\Desinstalar {#AppName}"; Filename: "{uninstallexe}"
Name: "{userdesktop}\{#AppName}"; Filename: "{app}\python\python.exe"; Parameters: """{app}\app\server.py"""; WorkingDir: "{app}\app"; IconFilename: "{app}\app-icon.ico"; Tasks: desktopicon

[Dirs]
Name: "{localappdata}\SlideAssistido\user_data"; Flags: uninsneveruninstall

[Run]
Filename: "{app}\python\python.exe"; Parameters: """{app}\app\server.py"""; WorkingDir: "{app}\app"; Description: "Abrir o Slide Assistido agora"; Flags: postinstall nowait skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\python"
Type: filesandordirs; Name: "{app}\app"

[Messages]
ptbr.FinishedLabel=A instalação foi concluída. As apresentações importadas ficam em %LOCALAPPDATA%\SlideAssistido e são preservadas em atualizações e na desinstalação.
