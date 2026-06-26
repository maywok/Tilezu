Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$cargoTarget = Join-Path $repoRoot 'src-tauri\target'
$setupExe = Join-Path $cargoTarget 'release\bundle\nsis\Tilezu_0.1.0_x64-setup.exe'

function Write-Step([string] $Message) {
  Write-Host $Message -ForegroundColor Cyan
}

$env:CARGO_TARGET_DIR = $cargoTarget
Write-Step ("Using CARGO_TARGET_DIR={0}" -f $cargoTarget)

Push-Location -LiteralPath $repoRoot
try {
  Write-Step 'Building Tauri release installer...'
  npx tauri build
  if ($LASTEXITCODE -ne 0) {
    throw "tauri build failed with exit code $LASTEXITCODE"
  }
}
finally {
  Pop-Location
}

if (-not (Test-Path -LiteralPath $setupExe)) {
  throw "Release installer was not produced at $setupExe"
}

$setupItem = Get-Item -LiteralPath $setupExe
Write-Step ("Installer ready: {0} ({1:N1} MB)" -f $setupItem.FullName, ($setupItem.Length / 1MB))