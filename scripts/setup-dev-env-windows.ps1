# hNotebook Windows dev helpers (JDK 21 + Maven for services/api).
# Run in PowerShell:  powershell -ExecutionPolicy Bypass -File scripts\setup-dev-env-windows.ps1
#
# Prerequisites: network access to winget / Adoptium / Apache (first-time downloads).

param(
  [string]$JdkHome = "",
  [switch]$InstallJdkWinget,
  [switch]$SkipPath
)

$ErrorActionPreference = "Stop"
$toolsRoot = Join-Path $env:LOCALAPPDATA "hNotebook-tools"
$mavenVer = "3.9.14"
$mavenHome = Join-Path $toolsRoot "apache-maven-$mavenVer"
$mavenBin = Join-Path $mavenHome "bin"

function Ensure-Maven {
  if (Test-Path (Join-Path $mavenBin "mvn.cmd")) { return }
  New-Item -ItemType Directory -Force -Path $toolsRoot | Out-Null
  $zip = Join-Path $toolsRoot "apache-maven-$mavenVer-bin.zip"
  $url = "https://downloads.apache.org/maven/maven-3/$mavenVer/binaries/apache-maven-$mavenVer-bin.zip"
  Write-Host "Downloading Maven $mavenVer ..."
  Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
  Expand-Archive -Path $zip -DestinationPath $toolsRoot -Force
}

function Add-MavenUserPath {
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  if ($userPath -like "*apache-maven-$mavenVer*") {
    Write-Host "Maven already present in user PATH."
    return
  }
  [Environment]::SetEnvironmentVariable("Path", "$userPath;$mavenBin", "User")
  Write-Host "Added to user PATH: $mavenBin"
}

function Detect-JdkHome {
  if ($JdkHome -and (Test-Path (Join-Path $JdkHome "bin\java.exe"))) { return $JdkHome }
  $candidates = @(
    "C:\Program Files\Eclipse Adoptium\jdk-21*",
    "C:\Program Files\Microsoft\jdk-21*"
  )
  foreach ($pat in $candidates) {
    $d = Get-Item $pat -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
    if ($d -and (Test-Path (Join-Path $d.FullName "bin\java.exe"))) { return $d.FullName }
  }
  $portable = Get-ChildItem $toolsRoot -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "jdk-21*" } | Sort-Object Name -Descending | Select-Object -First 1
  if ($portable -and (Test-Path (Join-Path $portable.FullName "bin\java.exe"))) { return $portable.FullName }
  return $null
}

function Ensure-JdkZipPortable {
  $existing = Detect-JdkHome
  if ($existing) { return $existing }
  New-Item -ItemType Directory -Force -Path $toolsRoot | Out-Null
  $jdkZip = Join-Path $toolsRoot "OpenJDK21-portable.zip"
  $url = "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk"
  Write-Host "Downloading portable JDK 21 (Temurin) ..."
  Invoke-WebRequest -Uri $url -OutFile $jdkZip -UseBasicParsing
  Expand-Archive -Path $jdkZip -DestinationPath $toolsRoot -Force
  return Detect-JdkHome
}

if ($InstallJdkWinget) {
  Write-Host "Installing JDK 21 via winget (may prompt UAC) ..."
  winget install EclipseAdoptium.Temurin.21.JDK --accept-package-agreements --accept-source-agreements --disable-interactivity
}

Ensure-Maven
if (-not $SkipPath) { Add-MavenUserPath }

$jdk = Detect-JdkHome
if (-not $jdk) {
  Write-Host ""
  Write-Host "JDK 21 not found. Choose one:"
  Write-Host "  A) Run this script with -InstallJdkWinget  (needs winget + admin/UAC for MSI)"
  Write-Host "  B) Install Temurin 21 manually from https://adoptium.net/"
  Write-Host "  C) Re-run with network OK: add portable JDK via script edit / call Ensure-JdkZipPortable"
  Write-Host ""
  exit 1
}

[Environment]::SetEnvironmentVariable("JAVA_HOME", $jdk, "User")
$env:JAVA_HOME = $jdk
$env:Path = "$jdk\bin;" + [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")

Write-Host "JAVA_HOME = $jdk"
& (Join-Path $mavenBin "mvn.cmd") -version
Write-Host ""
Write-Host "Done. Open a NEW terminal so PATH/JAVA_HOME apply everywhere, then:"
Write-Host "  cd services\api"
Write-Host "  mvn spring-boot:run"
