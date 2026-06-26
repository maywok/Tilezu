param(
  [switch] $KeepRelease,
  [switch] $Deep,
  [switch] $Quiet
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Info([string] $Message) {
  if (-not $Quiet) {
    Write-Host $Message
  }
}

function Get-DirectorySizeBytes([string] $Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    return 0
  }

  $measured = Get-ChildItem -LiteralPath $Path -Recurse -Force -File -ErrorAction SilentlyContinue |
    Measure-Object -Property Length -Sum

  if ($null -eq $measured -or $null -eq $measured.Sum) {
    return 0
  }

  return [int64] $measured.Sum
}

function Format-Megabytes([int64] $Bytes) {
  return '{0:N1} MB' -f ($Bytes / 1MB)
}

function Remove-TreeIfExists([string] $Path, [string] $Label) {
  if (-not (Test-Path -LiteralPath $Path)) {
    return 0
  }

  $before = Get-DirectorySizeBytes $Path
  Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
  Write-Info ("Removed {0} ({1})" -f $Label, (Format-Megabytes $before))
  return $before
}

function Remove-FilesIfExists([string[]] $Paths, [string] $Label) {
  $removed = 0
  foreach ($path in $Paths) {
    if (-not (Test-Path -LiteralPath $path)) {
      continue
    }

    $item = Get-Item -LiteralPath $path -Force
    if ($item.PSIsContainer) {
      $removed += Remove-TreeIfExists $path $Label
      continue
    }

    $size = [int64] $item.Length
    Remove-Item -LiteralPath $path -Force -ErrorAction Stop
    $removed += $size
  }

  if ($removed -gt 0) {
    Write-Info ("Removed {0} ({1})" -f $Label, (Format-Megabytes $removed))
  }

  return $removed
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

Write-Info 'Tile Manager: cleaning rebuild caches...'

Get-Process -Name app -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

$totalFreed = 0

$totalFreed += Remove-TreeIfExists (Join-Path $repoRoot 'dist') 'Vite dist output'
$totalFreed += Remove-TreeIfExists (Join-Path $repoRoot 'node_modules\.vite') 'Vite dependency cache'
$totalFreed += Remove-TreeIfExists (Join-Path $repoRoot 'node_modules\.cache') 'Node module cache'

$tsBuildInfo = @(
  Join-Path $repoRoot 'tsconfig.tsbuildinfo'
  Join-Path $repoRoot 'tsconfig.app.tsbuildinfo'
  Join-Path $repoRoot 'tsconfig.node.tsbuildinfo'
)
$totalFreed += Remove-FilesIfExists $tsBuildInfo 'TypeScript build info'

$totalFreed += Remove-TreeIfExists (
  Join-Path $repoRoot 'src-tauri\src-tauri\target'
) 'Legacy duplicate Cargo target (src-tauri/src-tauri/target)'

$cargoRoot = Join-Path $repoRoot 'src-tauri\target'

if ($Deep) {
  $totalFreed += Remove-TreeIfExists (Join-Path $cargoRoot 'debug') 'Rust debug build output (deep clean)'
  Write-Info 'Note: artifacts\app.exe is kept as the portable backup exe.'
} elseif (Test-Path -LiteralPath $cargoRoot) {
  $totalFreed += Remove-FilesIfExists @(
    Join-Path $cargoRoot 'debug\deps\app.pdb'
  ) 'Stale debug linker artifacts'
}

if (-not $KeepRelease) {
  $totalFreed += Remove-TreeIfExists (Join-Path $cargoRoot 'release') 'Rust release build output'
}

$sandboxRoot = Join-Path $env:LOCALAPPDATA 'Temp\cursor-sandbox-cache'
if (Test-Path -LiteralPath $sandboxRoot) {
  Get-ChildItem -LiteralPath $sandboxRoot -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $cargoTarget = Join-Path $_.FullName 'cargo-target'
    $totalFreed += Remove-TreeIfExists $cargoTarget ('Cursor sandbox cargo-target ({0})' -f $_.Name)
  }
}

$totalFreed += Remove-TreeIfExists (Join-Path $repoRoot 'test-results') 'Playwright test-results'
$totalFreed += Remove-TreeIfExists (Join-Path $repoRoot 'playwright-report') 'Playwright HTML report'
$totalFreed += Remove-TreeIfExists (Join-Path $repoRoot 'storybook-static') 'Storybook static export'

Write-Info ("Done. Estimated space reclaimed: {0}" -f (Format-Megabytes $totalFreed))

$freeGb = [math]::Round((Get-PSDrive -Name C).Free / 1GB, 2)
Write-Info ("C: free space now: {0} GB" -f $freeGb)

if ($freeGb -lt 2) {
  Write-Warning 'Less than 2 GB free on C:. Tauri debug builds may still fail until more disk space is available.'
  exit 2
}

exit 0
