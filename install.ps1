# Files Workbench - Windows installer (pre-alpha).
# Downloads the latest NSIS installer (.exe) from GitHub Releases and runs it.
#
#   irm https://raw.githubusercontent.com/miclaymon/files-workbench/main/install.ps1 | iex
#
# Unsigned pre-alpha builds trigger SmartScreen: choose "More info" -> "Run anyway".
$ErrorActionPreference = 'Stop'

$Repo = 'miclaymon/files-workbench'
$Headers = @{ 'User-Agent' = 'files-workbench-install' }

Write-Host "Finding the latest Files Workbench release..."
$release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest" -Headers $Headers
$asset = $release.assets | Where-Object { $_.name -like '*.exe' } | Select-Object -First 1

if (-not $asset) {
  throw "No .exe installer found in the latest release of $Repo. (A maintainer needs to attach the Windows installer to a GitHub Release.)"
}

$out = Join-Path $env:TEMP $asset.name
Write-Host "Downloading: $($asset.browser_download_url)"
Invoke-WebRequest $asset.browser_download_url -OutFile $out -Headers $Headers

Write-Host "Running installer..."
Start-Process -FilePath $out -Wait

Write-Host "Done. If Windows SmartScreen warned you, that's expected for an unsigned pre-alpha build."
