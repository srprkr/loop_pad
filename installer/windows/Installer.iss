; Windows installer, built by .github/workflows/build.yml with Inno Setup.
; Installs the VST3 where every DAW looks for it, plus the Standalone app.
;
; Every name comes from the identity block in CMakeLists.txt; CI passes them in. By hand:
;   ISCC /DAppName="Loop Pad" /DAppFileName=LoopPad /DAppPublisher="Your Company" ^
;        /DAppId=<PRODUCT_WINDOWS_APP_ID> /DAppVersion=0.1.0 ^
;        /DBuildDir=<repo>\build\plugin\LoopPad_artefacts\Release Installer.iss
; MicrosoftEdgeWebview2Setup.exe must be in this folder (the workflow downloads it).

#ifndef AppVersion
  #define AppVersion "0.1.0"
#endif
#ifndef AppName
  #error Pass /DAppName=<PRODUCT_NAME>
#endif
#ifndef AppFileName
  #error Pass /DAppFileName=<PRODUCT_TARGET>
#endif
#ifndef AppPublisher
  #define AppPublisher AppName
#endif
#ifndef AppId
  #error Pass /DAppId=<PRODUCT_WINDOWS_APP_ID>
#endif
#ifndef BuildDir
  #error Pass /DBuildDir=<path to <target>_artefacts\Release>
#endif

[Setup]
; The AppId is how Windows knows a new version replaces the old one: keep it forever.
AppId={{{#AppId}}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
DisableDirPage=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
UninstallDisplayName={#AppName}
UninstallDisplayIcon={app}\{#AppName}.exe
OutputBaseFilename={#AppFileName}-{#AppVersion}-Windows-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut for the Standalone app"; Flags: unchecked

[Files]
; {commoncf64} is C:\Program Files\Common Files, so this is the standard VST3 folder.
Source: "{#BuildDir}\VST3\{#AppName}.vst3\*"; DestDir: "{commoncf64}\VST3\{#AppName}.vst3"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#BuildDir}\Standalone\{#AppName}.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall; Check: NeedsWebView2

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppName}.exe"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppName}.exe"; Tasks: desktopicon

[Run]
; The plugin's interface needs the WebView2 runtime. Most PCs already have it.
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "Installing the Microsoft WebView2 runtime..."; Check: NeedsWebView2
Filename: "{app}\{#AppName}.exe"; Description: "Open {#AppName} now"; Flags: nowait postinstall skipifsilent

[Code]
const
  WebView2Key = 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';

function RuntimeRegistered(RootKey: Integer): Boolean;
var
  Version: String;
begin
  Result := RegQueryStringValue(RootKey, WebView2Key, 'pv', Version)
            and (Version <> '') and (Version <> '0.0.0.0');
end;

function NeedsWebView2: Boolean;
begin
  Result := not (RuntimeRegistered(HKLM32) or RuntimeRegistered(HKCU));
end;
