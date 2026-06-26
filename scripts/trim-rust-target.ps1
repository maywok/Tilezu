param(
  [switch] $KeepIncremental
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-DirBytes([string] $Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return 0 }
  $sum = (Get-ChildItem -LiteralPath $Path -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
  if ($null -eq $sum) { return 0 }
  return [int64] $sum
}

function Remove-IfExists([string] $Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return 0 }
  $before = Get-DirBytes $Path
  Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
  return $before
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$debugRoot = Join-Path $repoRoot 'src-tauri\target\debug'
$appExe = Join-Path $debugRoot 'app.exe'

if (-not (Test-Path -LiteralPath $appExe)) {
  Write-Error 'Nothing to trim: src-tauri\target\debug\app.exe is missing.'
}

Get-Process -Name app -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

$freed = 0
$freed += Remove-IfExists (Join-Path $debugRoot 'deps')
$freed += Remove-IfExists (Join-Path $debugRoot 'build')
$freed += Remove-IfExists (Join-Path $debugRoot 'incremental')
$freed += Remove-IfExists (Join-Path $debugRoot 'app.d')
$freed += Remove-IfExists (Join-Path $debugRoot 'app.pdb')

if (-not $KeepIncremental) {
  $freed += Remove-IfExists (Join-Path $debugRoot '.fingerprint')
}

$remaining = Get-DirBytes $debugRoot
Write-Host ("Trimmed {0:N1} MB from Rust target cache." -f ($freed / 1MB)) -ForegroundColor Green
Write-Host ("Kept app.exe ({0:N1} MB). target\debug now ~{1:N1} MB." -f ((Get-Item $appExe).Length / 1MB), ($remaining / 1MB))
Write-Host 'Next Rust change needs a full rebuild (npm run build:tauri:debug).' -ForegroundColor DarkGray