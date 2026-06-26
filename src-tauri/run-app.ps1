$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$exeCandidates = @(
  (Join-Path $PSScriptRoot 'target\debug\app.exe'),
  (Join-Path $PSScriptRoot 'src-tauri\target\debug\app.exe')
)
$exePath = $exeCandidates |
  Where-Object { Test-Path $_ } |
  Sort-Object { (Get-Item $_).LastWriteTime } -Descending |
  Select-Object -First 1

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,
    [Parameter(Mandatory = $true)]
    [string]$WorkingDirectory,
    [Parameter(Mandatory = $true)]
    [string]$Label
  )

  Write-Host $Label -ForegroundColor Cyan
  Push-Location $WorkingDirectory
  try {
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "Command failed with exit code $LASTEXITCODE"
    }
  }
  finally {
    Pop-Location
  }
}

Write-Host 'Stopping any running app.exe before rebuild...' -ForegroundColor DarkGray
Get-CimInstance Win32_Process -Filter "Name = 'app.exe'" -ErrorAction SilentlyContinue | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

# Clean up old debug build artifacts to free disk space.
# Remove files older than 7 days in the debug target directory (safe housekeeping).
try {
  $debugDir = Join-Path $repoRoot 'src-tauri\target\debug'
  if (Test-Path $debugDir) {
    Write-Host "Cleaning old debug artifacts in: $debugDir" -ForegroundColor DarkGray
    # Remove files and directories older than 7 days
    $threshold = (Get-Date).AddDays(-7)
    Get-ChildItem -Path $debugDir -Recurse -Force -ErrorAction SilentlyContinue |
      Where-Object { $_.LastWriteTime -lt $threshold } |
      ForEach-Object {
        try { Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue } catch { }
      }
    # Additionally, remove temp build folders (*.tmp) and stale libs older than 1 day
    Get-ChildItem -Path $debugDir -Include '*.tmp','*.temp' -Recurse -Force -ErrorAction SilentlyContinue |
      Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-1) } |
      ForEach-Object { try { Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue } catch { } }
  }
} catch {
  Write-Host 'Cleanup step failed (non-fatal).' -ForegroundColor Yellow
}

Invoke-CheckedCommand -FilePath 'npm.cmd' -Arguments @('run', 'build:tauri:debug') -WorkingDirectory $repoRoot -Label 'Building latest debug executable and frontend assets...'

if (-not (Test-Path $exePath)) {
  Write-Host "app.exe not found after build at: $exePath" -ForegroundColor Red
  exit 1
}

$exeItem = Get-Item $exePath
$exeHash = (Get-FileHash $exePath -Algorithm SHA256).Hash
Write-Host ("Using debug exe: {0}" -f $exePath) -ForegroundColor Cyan
Write-Host ("Last write: {0}" -f $exeItem.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss')) -ForegroundColor Cyan
Write-Host ("SHA256: {0}" -f $exeHash) -ForegroundColor DarkCyan

Start-Sleep -Milliseconds 350
Start-Process -FilePath $exePath | Out-Null

try {
  Add-Type -Namespace Win32 -Name User32 -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("user32.dll")]
public static extern bool ShowWindowAsync(System.IntPtr hWnd, int nCmdShow);
[System.Runtime.InteropServices.DllImport("user32.dll")]
public static extern bool SetForegroundWindow(System.IntPtr hWnd);
'@
}
catch {
}

$windowProcess = $null
1..30 | ForEach-Object {
  $candidate = Get-Process app -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -ne $candidate -and $candidate.MainWindowHandle -ne 0) {
    $windowProcess = $candidate
    break
  }

  Start-Sleep -Milliseconds 250
}

if ($null -ne $windowProcess) {
  [Win32.User32]::ShowWindowAsync($windowProcess.MainWindowHandle, 9) | Out-Null
  [Win32.User32]::SetForegroundWindow($windowProcess.MainWindowHandle) | Out-Null
  Write-Host "Launched and focused: $exePath" -ForegroundColor Green
  exit 0
}

Write-Host "Started process, but no visible window handle yet. Check taskbar and Alt+Tab for Tilezu." -ForegroundColor Yellow
exit 0
