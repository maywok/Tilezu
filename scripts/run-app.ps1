param(
  [switch] $RefreshFrontend,
  [switch] $UseSavedOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$primaryExe = Join-Path $repoRoot 'src-tauri\target\debug\app.exe'
$savedExe = Join-Path $repoRoot 'artifacts\app.exe'

function Write-Step([string] $Message) {
  Write-Host $Message -ForegroundColor Cyan
}

Push-Location -LiteralPath $repoRoot
try {
  if ($RefreshFrontend) {
    Write-Step 'Building frontend only (tsc + vite)...'
    npm run build
    if ($LASTEXITCODE -ne 0) {
      throw 'Frontend build failed.'
    }
  }

  $exePath = $null
  if (-not $UseSavedOnly -and (Test-Path -LiteralPath $primaryExe)) {
    $exePath = $primaryExe
    Write-Step 'Launching src-tauri\target\debug\app.exe'
  } elseif (Test-Path -LiteralPath $savedExe) {
    $exePath = $savedExe
    Write-Step 'Launching saved artifacts\app.exe (no full Rust rebuild needed)'
  } else {
    throw @(
      'No app.exe found.',
      '  Run a full rebuild once: npm run build:tauri:debug',
      '  Or restore a copy to artifacts\app.exe'
    ) -join "`n"
  }

  $exe = Get-Item -LiteralPath $exePath
  Write-Host ("  {0} ({1:N1} MB, {2})" -f $exe.FullName, ($exe.Length / 1MB), $exe.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss')) -ForegroundColor DarkGray

  Get-Process -Name app -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Process -FilePath $exe.FullName -WorkingDirectory $repoRoot
}
finally {
  Pop-Location
}