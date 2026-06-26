Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$artifactDir = Join-Path $repoRoot 'artifacts'
$artifactExe = Join-Path $artifactDir 'app.exe'
$primaryExe = Join-Path $repoRoot 'src-tauri\target\debug\app.exe'

New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null

if (-not (Test-Path -LiteralPath $primaryExe)) {
  Write-Error 'No debug app.exe at src-tauri\target\debug\app.exe to archive.'
}

Copy-Item -LiteralPath $primaryExe -Destination $artifactExe -Force
$exe = Get-Item -LiteralPath $artifactExe

Write-Host ("Archived debug app to {0}" -f $exe.FullName) -ForegroundColor Green
Write-Host ("Updated: {0}" -f $exe.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))
Write-Host ("Size:    {0:N1} MB" -f ($exe.Length / 1MB))