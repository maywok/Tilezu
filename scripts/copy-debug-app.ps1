Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$primary = Join-Path $repoRoot 'src-tauri\target\debug\app.exe'

if (-not (Test-Path -LiteralPath $primary)) {
  Write-Error 'No debug app.exe found at src-tauri\target\debug\app.exe'
}

$exe = Get-Item -LiteralPath $primary
Write-Host ("Debug app ready at {0}" -f $exe.FullName)
Write-Host ("Updated: {0}" -f $exe.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))
Write-Host ("Size:    {0:N1} MB" -f ($exe.Length / 1MB))
