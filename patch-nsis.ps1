# Post-build script to include WebView2Loader.dll and VITS in the NSIS installer
param()

$ErrorActionPreference = "Stop"

$projectRoot = $PSScriptRoot
$nsisDir = Join-Path $projectRoot "src-tauri\target\release\nsis\x64"
$installerNsi = Join-Path $nsisDir "installer.nsi"
$dllSource = Join-Path $projectRoot "src-tauri\target\release\WebView2Loader.dll"
$makensis = "C:\Program Files (x86)\NSIS\Bin\makensis.exe"

if (-not (Test-Path $installerNsi)) {
    Write-Error "NSIS script not found: $installerNsi"
    exit 1
}
if (-not (Test-Path $dllSource)) {
    Write-Error "WebView2Loader.dll not found: $dllSource"
    exit 1
}

Write-Host "Reading NSIS script..."
$content = [System.IO.File]::ReadAllText($installerNsi)
# Normalize line endings to avoid \r\n vs \n mismatch with here-strings
$content = $content.Replace("`r`n", "`n")

# === WebView2Loader.dll ===
if ($content -match "WebView2Loader\.dll") {
    Write-Host "WebView2Loader already patched, skipping."
} else {
    Write-Host "Patching NSIS script to include WebView2Loader.dll..."
    $dllEscaped = $dllSource.Replace('\', '\\')
    $find = '  File "${MAINBINARYSRCPATH}"'
    $replace = $find + "`r`n  File `"/oname=WebView2Loader.dll`" `"$dllEscaped`""
    $content = $content.Replace($find, $replace)

    $find = '  Delete "$INSTDIR\${MAINBINARYNAME}.exe"'
    $replace = $find + "`r`n  Delete `"`$INSTDIR\WebView2Loader.dll`""
    $content = $content.Replace($find, $replace)
}

# === VITS bundling ===
$vitsSource = "D:\AICHAT\vits"
$vitsStaging = Join-Path $nsisDir "vits"

if ((Test-Path $vitsSource) -and ($content -notmatch "VITS server")) {
    Write-Host "Copying VITS folder to NSIS staging ($vitsSource -> $vitsStaging)..."
    if (Test-Path $vitsStaging) {
        Remove-Item $vitsStaging -Recurse -Force
    }
    Copy-Item $vitsSource $vitsStaging -Recurse -Force
    Write-Host "VITS copy done."

    Write-Host "Patching NSIS for VITS install..."

    # Insert VITS install commands before the end of the main section.
    # Target the unique block right before .onInstSuccess
    $find = @'
  ; Auto close this page for passive mode
  ${If} $PassiveMode = 1
    SetAutoClose true
  ${EndIf}
SectionEnd

Function .onInstSuccess
'@
    $replace = @'
  ; Auto close this page for passive mode
  ${If} $PassiveMode = 1
    SetAutoClose true
  ${EndIf}
  ; --- VITS server: copy from installer source directory ---
  IfFileExists "$EXEDIR\vits\*.*" 0 vits_skip
    CreateDirectory "$INSTDIR\vits"
    CopyFiles /SILENT "$EXEDIR\vits\*.*" "$INSTDIR\vits"
  vits_skip:
SectionEnd

Function .onInstSuccess
'@
    $content = $content.Replace($find, $replace)

    # Insert VITS uninstall cleanup before the final RMDir
    $find = '  RMDir "$INSTDIR"'
    $replace = '  RMDir /r /REBOOTOK "$INSTDIR\vits"' + "`r`n  RMDir `"`$INSTDIR`""
    $content = $content.Replace($find, $replace)

    Write-Host "VITS NSIS patch applied."
} elseif (-not (Test-Path $vitsSource)) {
    Write-Host "VITS source not found at $vitsSource, skipping VITS bundling."
} else {
    Write-Host "VITS already patched, skipping."
}

Write-Host "Writing NSIS script..."
# Convert back to CRLF for makensis
$content = $content.Replace("`n", "`r`n")
[System.IO.File]::WriteAllText($installerNsi, $content)

Write-Host "Running makensis..."
& $makensis $installerNsi

Write-Host "Copying output..."
$output = Join-Path $nsisDir "nsis-output.exe"
$bundleDir = Join-Path $projectRoot "src-tauri\target\release\bundle\nsis"
Copy-Item $output (Join-Path $bundleDir "Murasame_1.0.0_x64-setup.exe") -Force

# Copy VITS folder alongside installer
if (Test-Path $vitsStaging) {
    $vitsBundleDir = Join-Path $bundleDir "vits"
    Write-Host "Copying VITS to bundle directory ($vitsStaging -> $vitsBundleDir)..."
    if (Test-Path $vitsBundleDir) {
        Remove-Item $vitsBundleDir -Recurse -Force
    }
    Copy-Item $vitsStaging $vitsBundleDir -Recurse -Force
    Write-Host "VITS bundle copy done."
}

Write-Host "Done! Installer is at: $bundleDir\Murasame_1.0.0_x64-setup.exe"
Write-Host "Run the installer from a folder that also contains the 'vits' folder."

# === 7-Zip SFX: bundle installer + vits into single self-extracting EXE ===
# SFX module priority: 7zSD.sfx > 7zS.sfx > 7z.sfx (basic, no auto-run)
# 7zSD.sfx and 7zS.sfx support ExecuteFile=auto-run after extraction.
# 7z.sfx only does basic extraction with no auto-run.
$sevenZip = "D:\7-Zip\7z.exe"
$sfxAutoRun = $true
$sfxModuleToUse = $null

$candidateSfxModules = @(
	@{ Path = "D:\7-Zip\7zSD.sfx"; AutoRun = $true },
	@{ Path = "D:\7-Zip\7zS.sfx";  AutoRun = $true },
	@{ Path = "D:\7-Zip\7z.sfx";   AutoRun = $false }
)

foreach ($cand in $candidateSfxModules) {
	if (Test-Path $cand.Path) {
		$sfxModuleToUse = $cand.Path
		$sfxAutoRun = $cand.AutoRun
		$sfxName = Split-Path $cand.Path -Leaf
		if ($sfxAutoRun) {
			Write-Host "Found $sfxName — SFX will auto-run installer after extraction."
		} else {
			Write-Host "Found $sfxName (basic SFX, no auto-run after extraction)."
		}
		break
	}
}

if (-not $sfxModuleToUse) {
	Write-Host "No SFX module found, skipping SFX creation."
}

if ((Test-Path $sevenZip) -and $sfxModuleToUse -and (Test-Path $vitsStaging)) {
	Write-Host "Creating self-extracting archive..."
	$sfxOutput = Join-Path $bundleDir "Murasame_Setup.exe"
	$archive7z = Join-Path $bundleDir "bundle.7z"
	$configFile = Join-Path $bundleDir "sfx.conf"

	# SFX config
	if ($sfxAutoRun) {
		@"
;!@Install@!UTF-8!
Title="丛雨桌面宠物 - 安装程序"
BeginPrompt="即将安装丛雨桌面宠物 (含 VITS 语音)。是否继续？"
ExecuteFile="Murasame_1.0.0_x64-setup.exe"
;!@InstallEnd@!
"@ | Out-File -FilePath $configFile -Encoding UTF8
	} else {
		@"
;!@Install@!UTF-8!
Title="丛雨桌面宠物 - 安装程序"
BeginPrompt="即将解压丛雨桌面宠物安装包 (含 VITS 语音)。解压后请运行 Murasame_1.0.0_x64-setup.exe 完成安装。是否继续？"
;!@InstallEnd@!
"@ | Out-File -FilePath $configFile -Encoding UTF8
	}

	# Create 7z archive (store mode for speed — files are already compressed, VITS is 7.7GB)
	Push-Location $bundleDir
	& $sevenZip a -mx0 -mmt8 $archive7z "Murasame_1.0.0_x64-setup.exe" "vits" 2>&1 | Out-Null
	Pop-Location

	if (Test-Path $archive7z) {
		# Combine: sfx stub + config + 7z archive
		cmd /c "copy /b `"$sfxModuleToUse`" + `"$configFile`" + `"$archive7z`" `"$sfxOutput`"" 2>&1 | Out-Null
		Remove-Item $archive7z -Force
		Remove-Item $configFile -Force
		if ($sfxAutoRun) {
			Write-Host "Self-extracting archive (auto-run) created: $sfxOutput"
		} else {
			Write-Host "Self-extracting archive created: $sfxOutput"
			Write-Host "NOTE: User must run Murasame_1.0.0_x64-setup.exe manually after extraction."
		}
	} else {
		Write-Host "7z creation failed, skipping SFX."
	}
} else {
	if (-not (Test-Path $sevenZip)) { Write-Host "7-Zip not found at D:\7-Zip\7z.exe, skipping SFX." }
	if (-not $sfxModuleToUse) { Write-Host "No SFX module available, skipping SFX." }
	if (-not (Test-Path $vitsStaging)) { Write-Host "VITS staging folder not found, skipping SFX." }
}
