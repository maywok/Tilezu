Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$candidates = @(
  (Join-Path $env:APPDATA 'com.mason.tilemanager\boot-perf.log'),
  (Join-Path $env:APPDATA 'Tilezu\boot-perf.log')
)

$existing = @($candidates | Where-Object { Test-Path $_ })
if ($existing.Count -eq 0) {
  Write-Host 'No boot perf log file found to reset.'
  exit 0
}

foreach ($path in $existing) {
  Clear-Content -Path $path -ErrorAction Stop
  Write-Host "Cleared boot perf log: $path"
}
