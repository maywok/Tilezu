Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Section([string]$title) {
  Write-Host "`n=== $title ==="
}

$workspaceRoot = Split-Path -Parent $PSScriptRoot
Set-Location $workspaceRoot

$releaseFiles = @(
  'src-tauri\target\release\app.exe',
  'src-tauri\target\release\bundle\msi\Tilezu_0.1.0_x64_en-US.msi',
  'src-tauri\target\release\bundle\nsis\Tilezu_0.1.0_x64-setup.exe'
)

Write-Section 'Release Artifacts'
foreach ($relativePath in $releaseFiles) {
  if (-not (Test-Path $relativePath)) {
    Write-Host "MISSING: $relativePath"
    continue
  }

  $item = Get-Item $relativePath
  $hash = (Get-FileHash $relativePath -Algorithm SHA256).Hash
  [PSCustomObject]@{
    Path = $item.FullName
    SizeMB = [Math]::Round($item.Length / 1MB, 2)
    LastWrite = $item.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss')
    SHA256 = $hash
  } | Format-List
}

$wixManifestPath = 'src-tauri\target\release\wix\x64\main.wxs'
Write-Section 'MSI Payload Sources'
if (-not (Test-Path $wixManifestPath)) {
  Write-Host "MISSING: $wixManifestPath"
  exit 0
}

[xml]$wixXml = Get-Content $wixManifestPath
$wixNs = New-Object System.Xml.XmlNamespaceManager($wixXml.NameTable)
$wixNs.AddNamespace('w', 'http://schemas.microsoft.com/wix/2006/wi')

$fileNodes = $wixXml.SelectNodes('//w:File', $wixNs)
if (-not $fileNodes -or $fileNodes.Count -eq 0) {
  Write-Host 'No <File /> nodes found in MSI manifest.'
  exit 0
}

$userProfile = [Environment]::GetFolderPath('UserProfile')
foreach ($node in $fileNodes) {
  $source = $node.GetAttribute('Source')
  if (-not $source) {
    continue
  }

  $containsUserProfilePath = $false
  if ($userProfile) {
    $containsUserProfilePath = $source.StartsWith($userProfile, [StringComparison]::OrdinalIgnoreCase)
  }

  [PSCustomObject]@{
    Source = $source
    UnderCurrentUserProfile = $containsUserProfilePath
  } | Format-Table -AutoSize
}
