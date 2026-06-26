param(
  [int]$LastRuns = 6
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$candidates = @(
  (Join-Path $env:APPDATA 'com.mason.tilemanager\boot-perf.log'),
  (Join-Path $env:APPDATA 'Tilezu\boot-perf.log')
)

$logPath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $logPath) {
  Write-Host 'No boot performance log file found.'
  exit 0
}

$rawLines = Get-Content $logPath | Where-Object { $_ -match '^\[boot\]\s+' }
if (-not $rawLines -or $rawLines.Count -eq 0) {
  Write-Host "Boot log exists but has no [boot] lines: $logPath"
  exit 0
}

function Get-BootPerfLineRecord {
  param([string]$line)

  if ($line -notmatch '^\[boot\]\s+([0-9\.]+)ms\s+([^|]+?)(?:\s+\|\s+(.*))?$') {
    return $null
  }

  $elapsedMs = [double]$matches[1]
  $stage = $matches[2].Trim()
  $detailsRaw = if ($matches.Count -ge 4) { $matches[3] } else { '' }
  $details = $null

  if ($detailsRaw -and $detailsRaw.Trim().StartsWith('{')) {
    try {
      $details = $detailsRaw | ConvertFrom-Json
    } catch {
      $details = $null
    }
  }

  return [PSCustomObject]@{
    ElapsedMs = $elapsedMs
    Stage = $stage
    Details = $details
  }
}

$bootLogEntries = @()
foreach ($line in $rawLines) {
  $parsed = Get-BootPerfLineRecord -line $line
  if ($null -ne $parsed) {
    $bootLogEntries += $parsed
  }
}

if ($bootLogEntries.Count -eq 0) {
  Write-Host 'No parsable boot events found.'
  exit 0
}

function ConvertTo-NullableDouble {
  param($Value)

  if ($null -eq $Value) {
    return $null
  }

  $parsedValue = 0.0
  if ([double]::TryParse([string]$Value, [ref]$parsedValue)) {
    return $parsedValue
  }

  return $null
}

$runs = @()
$current = @()
foreach ($bootEntry in $bootLogEntries) {
  if ($bootEntry.Stage -eq 'main:module-evaluated' -and $current.Count -gt 0) {
    $runs += ,$current
    $current = @()
  }
  $current += $bootEntry
}
if ($current.Count -gt 0) {
  $runs += ,$current
}

$recentRuns = $runs | Select-Object -Last ([Math]::Max(1, $LastRuns))

Write-Host "Log file: $logPath"
Write-Host "Runs analyzed: $($recentRuns.Count) (from total $($runs.Count))"

Write-Host "`n=== Per-Run Milestones ==="
$runIndex = 0
$renderToAppSeries = @()
foreach ($run in $recentRuns) {
  $runIndex += 1
  $map = @{}
  foreach ($runEntry in $run) {
    $map[$runEntry.Stage] = $runEntry.ElapsedMs
  }

  $renderMs = if ($map.ContainsKey('main:render-start')) { [Math]::Round($map['main:render-start'], 1) } else { $null }
  $appMs = if ($map.ContainsKey('app:mounted')) { [Math]::Round($map['app:mounted'], 1) } else { $null }
  $hydrateMs = if ($map.ContainsKey('splash:cover-hydration-complete')) { [Math]::Round($map['splash:cover-hydration-complete'], 1) } else { $null }
  $renderToApp = if ($null -ne $renderMs -and $null -ne $appMs) { [Math]::Round($appMs - $renderMs, 1) } else { $null }

  if ($null -ne $renderToApp) {
    $renderToAppSeries += $renderToApp
  }

  Write-Host ("Run {0}: render={1}ms, hydrate={2}ms, appMounted={3}ms, renderToApp={4}ms" -f $runIndex, $renderMs, $hydrateMs, $appMs, $renderToApp)
}

if ($renderToAppSeries.Count -gt 0) {
  $avg = [Math]::Round((($renderToAppSeries | Measure-Object -Average).Average), 1)
  $max = [Math]::Round((($renderToAppSeries | Measure-Object -Maximum).Maximum), 1)
  Write-Host "renderToApp avg=${avg}ms max=${max}ms"
}

Write-Host "`n=== Slowest Timed Spans (durationMs) ==="
$spanSamples = @()
foreach ($bootEntry in $bootLogEntries) {
  if ($bootEntry.Stage -notlike '*:done') {
    continue
  }

  if ($null -eq $bootEntry.Details) {
    continue
  }

  $duration = ConvertTo-NullableDouble -Value $bootEntry.Details.durationMs
  if ($null -eq $duration) {
    continue
  }

  $spanSamples += [PSCustomObject]@{
      Stage = $bootEntry.Stage
    DurationMs = $duration
  }
}

if ($spanSamples.Count -eq 0) {
  Write-Host 'No :done span samples found yet.'
} else {
  $spanSamples |
    Group-Object Stage |
    ForEach-Object {
      $durations = $_.Group.DurationMs
      [PSCustomObject]@{
        Stage = $_.Name
        Count = $_.Count
        AvgMs = [Math]::Round((($durations | Measure-Object -Average).Average), 2)
        MaxMs = [Math]::Round((($durations | Measure-Object -Maximum).Maximum), 2)
      }
    } |
    Sort-Object MaxMs -Descending |
    Select-Object -First 14 |
    Format-Table -AutoSize
}

Write-Host "`n=== Long Tasks ==="
$longTasks = @()
foreach ($bootEntry in $bootLogEntries) {
  if ($bootEntry.Stage -ne 'runtime:longtask' -or $null -eq $bootEntry.Details) {
    continue
  }

  $duration = ConvertTo-NullableDouble -Value $bootEntry.Details.durationMs
  if ($null -ne $duration) {
    $longTasks += $duration
  }
}

if ($longTasks.Count -eq 0) {
  Write-Host 'No runtime:longtask entries captured yet.'
} else {
  $avg = [Math]::Round((($longTasks | Measure-Object -Average).Average), 2)
  $max = [Math]::Round((($longTasks | Measure-Object -Maximum).Maximum), 2)
  Write-Host ("Count={0} AvgMs={1} MaxMs={2}" -f $longTasks.Count, $avg, $max)
}

Write-Host "`n=== Tauri Command Durations ==="
$tauriSamples = @()
foreach ($bootEntry in $bootLogEntries) {
  if ($bootEntry.Stage -notlike 'tauri:*:done' -or $null -eq $bootEntry.Details) {
    continue
  }

  $duration = ConvertTo-NullableDouble -Value $bootEntry.Details.durationMs
  if ($null -ne $duration) {
    $tauriSamples += [PSCustomObject]@{
      Stage = $bootEntry.Stage
      DurationMs = $duration
    }
  }
}

if ($tauriSamples.Count -eq 0) {
  Write-Host 'No timed tauri command spans captured yet.'
} else {
  $tauriSamples |
    Group-Object Stage |
    ForEach-Object {
      $durations = $_.Group.DurationMs
      [PSCustomObject]@{
        Command = $_.Name
        Count = $_.Count
        AvgMs = [Math]::Round((($durations | Measure-Object -Average).Average), 2)
        MaxMs = [Math]::Round((($durations | Measure-Object -Maximum).Maximum), 2)
      }
    } |
    Sort-Object MaxMs -Descending |
    Format-Table -AutoSize
}
