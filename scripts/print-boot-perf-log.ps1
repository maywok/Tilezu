param(
  [int]$Tail = 80
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$candidates = @(
  (Join-Path $env:APPDATA 'com.mason.tilemanager\boot-perf.log'),
  (Join-Path $env:APPDATA 'Tilezu\boot-perf.log')
)

$logPath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $logPath) {
  Write-Host 'No boot performance log file found yet.'
  Write-Host 'Run the app once, then run this command again.'
  exit 0
}

Write-Host "Boot log path: $logPath"
Get-Content $logPath -Tail ([Math]::Max(1, $Tail))
