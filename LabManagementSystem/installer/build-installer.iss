; ==============================================================================
; Lab Management System (LMS) Medical365 - Local Edition Windows Installer
; Inno Setup 6 Script
; ==============================================================================

#define MyAppName "LMS Medical365 - Local Edition"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Medical365 Laboratory Solutions"
#define MyAppURL "https://medical365.local"
#define MyAppExeName "manage-lms.bat"

[Setup]
AppId={{D37F80E2-998C-4B1D-9B8A-A5E8D6241F8C}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\LMS_Medical365
DefaultGroupName=LMS Medical365
AllowNoIcons=yes
OutputDir=..\installer_dist
OutputBaseFilename=LMS_Medical365_Local_Edition_Setup_v1.0.0
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern

; System & Platform Requirements
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog
ExtraDiskSpaceRequired=10737418240

; Visuals & UI
DisableDirPage=no
DisableProgramGroupPage=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "firewallrule"; Description: "Configure Windows Firewall rule for LAN Workstation Access (Port 80)"; GroupDescription: "Network Configuration:"
Name: "loadimages"; Description: "Load Offline Docker Images (mongo, backend, frontend) into Docker engine"; GroupDescription: "Docker Configuration:"; Flags: checkedonce

[Files]
; Root configuration and docker files
Source: "..\docker-compose.local.yml"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\docker\*"; DestDir: "{app}\docker"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\docker\local.env.example"; DestDir: "{app}\docker"; Flags: ignoreversion
; CRITICAL SAFETY: Never overwrite or delete local.env or license.key if they exist
Source: "..\docker\local.env"; DestDir: "{app}\docker"; Flags: onlyifdoesntexist uninsneveruninstall
Source: "..\docker\license.key"; DestDir: "{app}\docker"; Flags: onlyifdoesntexist uninsneveruninstall
Source: "..\docker\machine.id"; DestDir: "{app}\docker"; Flags: onlyifdoesntexist uninsneveruninstall
Source: "..\storage\*"; DestDir: "{app}\storage"; Flags: onlyifdoesntexist recursesubdirs createallsubdirs uninsneveruninstall

; Operational scripts
Source: "..\scripts\*"; DestDir: "{app}\scripts"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "launcher.bat"; DestDir: "{app}"; DestName: "manage-lms.bat"; Flags: ignoreversion

; Server codebase and dependencies
Source: "..\server\*"; DestDir: "{app}\server"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "node_modules\*,backups\*,logs\*,*.log"

; Client build artifacts and source
Source: "..\client\*"; DestDir: "{app}\client"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "node_modules\*,dist\*,*.log"

; Backups directory (Strictly preserved on uninstall)
Source: "..\backups\*"; DestDir: "{app}\backups"; Flags: onlyifdoesntexist recursesubdirs createallsubdirs uninsneveruninstall

[Icons]
Name: "{group}\LMS Management Console"; Filename: "{app}\manage-lms.bat"; WorkingDir: "{app}"
Name: "{group}\Start LMS Services"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\scripts\start-lms.ps1"""; WorkingDir: "{app}"
Name: "{group}\Stop LMS Services"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\scripts\stop-lms.ps1"""; WorkingDir: "{app}"
Name: "{group}\Open Web Portal"; Filename: "http://localhost"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\LMS Medical365 Management"; Filename: "{app}\manage-lms.bat"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
; Configure Windows Firewall for Port 80 LAN access
Filename: "netsh.exe"; Parameters: "advfirewall firewall add rule name=""LMS Medical365 LAN Access (Port 80)"" dir=in action=allow protocol=TCP localport=80 profile=private,domain"; Tasks: firewallrule; Flags: runhidden

; Initialize and persist deterministic hardware machine fingerprint
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\get-machine-fingerprint.ps1"""; StatusMsg: "Configuring hardware machine fingerprint identifier..."; Flags: runhidden

; Load offline Docker images before service launch
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\load-offline-images.ps1"" -ArchivePath ""{code:GetOfflineImageArchivePath}"""; StatusMsg: "Loading offline Docker container images into Docker engine (Please wait 1-2 minutes)..."; Tasks: loadimages; Flags: runhidden; Check: ShouldLoadOfflineImages

; Optional launch of management console on finish
Filename: "{app}\manage-lms.bat"; Description: "Launch LMS Medical365 Management Console"; Flags: nowait postinstall skipifsilent

[Code]
// System requirement verification
function IsDockerInstalled(): Boolean;
var
  DockerFound: Boolean;
begin
  DockerFound := FileExists(ExpandConstant('{commonpf}\Docker\Docker\resources\bin\docker.exe')) or
                 FileExists(ExpandConstant('{localappdata}\Programs\DockerDesktop\resources\bin\docker.exe')) or
                 RegKeyExists(HKLM, 'SOFTWARE\Docker Inc.\Docker');
  Result := DockerFound;
end;

function HasOfflineImageArchive(): Boolean;
begin
  Result := FileExists(ExpandConstant('{src}\LMS_Medical365_Offline_Images_v1.0.0.tar')) or
            FileExists(ExpandConstant('{src}\installer_dist\LMS_Medical365_Offline_Images_v1.0.0.tar')) or
            FileExists(ExpandConstant('{app}\installer_dist\LMS_Medical365_Offline_Images_v1.0.0.tar'));
end;

function GetOfflineImageArchivePath(Param: String): String;
begin
  if FileExists(ExpandConstant('{src}\LMS_Medical365_Offline_Images_v1.0.0.tar')) then
    Result := ExpandConstant('{src}\LMS_Medical365_Offline_Images_v1.0.0.tar')
  else if FileExists(ExpandConstant('{src}\installer_dist\LMS_Medical365_Offline_Images_v1.0.0.tar')) then
    Result := ExpandConstant('{src}\installer_dist\LMS_Medical365_Offline_Images_v1.0.0.tar')
  else if FileExists(ExpandConstant('{app}\installer_dist\LMS_Medical365_Offline_Images_v1.0.0.tar')) then
    Result := ExpandConstant('{app}\installer_dist\LMS_Medical365_Offline_Images_v1.0.0.tar')
  else
    Result := ExpandConstant('{src}\LMS_Medical365_Offline_Images_v1.0.0.tar');
end;

function ShouldLoadOfflineImages(): Boolean;
begin
  Result := IsDockerInstalled() and HasOfflineImageArchive();
end;

function InitializeSetup(): Boolean;
begin
  // 1. Check Windows 64-bit Architecture
  if not Is64BitInstallMode then
  begin
    MsgBox('LMS Medical365 Local Edition requires a 64-bit version of Windows 10, 11, or Windows Server.', mbCriticalError, MB_OK);
    Result := False;
    Exit;
  end;

  // 2. Check for Docker Desktop
  if not IsDockerInstalled() then
  begin
    if MsgBox('Docker Desktop for Windows does not appear to be installed.' + #13#10 + #13#10 +
              'LMS Medical365 requires Docker Desktop to host MongoDB, Backend, and Frontend containers.' + #13#10 + #13#10 +
              'Would you like to proceed with installation anyway?' + #13#10 +
              '(You must install and start Docker Desktop before launching LMS services).',
              mbConfirmation, MB_YESNO) = IDNO then
    begin
      Result := False;
      Exit;
    end;
  end;

  // 3. Check for Offline Docker Image Archive
  if not HasOfflineImageArchive() then
  begin
    Log('Offline Docker image archive (LMS_Medical365_Offline_Images_v1.0.0.tar) not detected in setup directory.');
    if MsgBox('Notice: The Offline Docker Image Archive (LMS_Medical365_Offline_Images_v1.0.0.tar) was not detected alongside this installer.' + #13#10 + #13#10 +
              'For air-gapped installation, place the archive in the same folder as this installer.' + #13#10 + #13#10 +
              'Would you like to continue installation anyway?' + #13#10 +
              '(You can load images later via scripts\load-offline-images.ps1).',
              mbConfirmation, MB_YESNO) = IDNO then
    begin
      Result := False;
      Exit;
    end;
  end;

  Result := True;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
  begin
    // Prompt to preserve clinical database volumes and backups
    if MsgBox('Would you like to preserve all existing patient records, clinical databases, and backup archives?' + #13#10 + #13#10 +
              '(Recommended: YES to prevent accidental loss of medical data).',
              mbConfirmation, MB_YESNO or MB_DEFBUTTON1) = IDYES then
    begin
      Log('User chose to preserve laboratory database volumes and backup archives.');
    end;
  end;
end;
