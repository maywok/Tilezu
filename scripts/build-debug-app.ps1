Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$cargoTarget = Join-Path $repoRoot 'src-tauri\target'
$primaryExe = Join-Path $cargoTarget 'debug\app.exe'

function Write-Step([string] $Message) {
  Write-Host $Message -ForegroundColor Cyan
}

$env:CARGO_TARGET_DIR = $cargoTarget
Write-Step ("Using CARGO_TARGET_DIR={0}" -f $cargoTarget)

Push-Location -LiteralPath $repoRoot
try {
  Write-Step 'Building Tauri debug executable (runs npm run build once via beforeBuildCommand)...'
  npx tauri build --debug --no-bundle
  if ($LASTEXITCODE -ne 0) {
    throw "tauri build --debug failed with exit code $LASTEXITCODE"
  }
}
finally {
  Pop-Location
}

$copyScript = Join-Path $PSScriptRoot 'copy-debug-app.ps1'
& $copyScript

$syncScript = Join-Path $PSScriptRoot 'sync-app-artifact.ps1'
& $syncScript

$trimScript = Join-Path $PSScriptRoot 'trim-rust-target.ps1'
& $trimScript

if (-not (Test-Path -LiteralPath $primaryExe)) {
  throw 'Debug app.exe was not produced. Check build output above.'
}

$exeItem = Get-Item -LiteralPath $primaryExe

Write-Host ''
Write-Host 'Debug app ready.' -ForegroundColor Green
Write-Host ("  Path:       {0}" -f $exeItem.FullName)
Write-Host ("  Updated:    {0}" -f $exeItem.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))
Write-Host ("  Size:       {0:N1} MB" -f ($exeItem.Length / 1MB))
Write-Host ("  SHA256:     {0}" -f (Get-FileHash -LiteralPath $exeItem.FullName -Algorithm SHA256).Hash)
Write-Host ''
Write-Host 'Launch with: npm run exe:run' -ForegroundColor DarkGray
Write-Host 'Saved backup:  artifacts\app.exe' -ForegroundColor DarkGray
