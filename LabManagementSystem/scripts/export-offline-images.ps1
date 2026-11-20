<#
.SYNOPSIS
    LMS Medical365 - Offline Docker Image Exporter
.DESCRIPTION
    Exports the required Local Edition Docker images (mongo:7.0, backend, frontend)
    into a standalone uncompressed TAR archive for air-gapped client installations.
    Generates SHA-256 checksum and JSON manifest.
    Does NOT export running containers, volumes, database records, or patient data.
    Does NOT stop or restart running services.
#>

[CmdletBinding()]
param(
    [string]$OutputDir = "",
    [string]$ArchiveName = "LMS_Medical365_Offline_Images_v1.0.0.tar",
    [switch]$Force = $false
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

if ([string]::IsNullOrWhiteSpace($OutputDir)) {
    $OutputDir = Join-Path $RootDir "installer_dist"
}

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Success($msg) { Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }

function Get-DockerPath {
    if (Get-Command docker -ErrorAction SilentlyContinue) { return "docker" }
    $candidates = @(
        "$env:ProgramFiles\Docker\Docker\resources\bin\docker.exe",
        "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe"
    )
    foreach ($path in $candidates) {
        if (Test-Path $path) { return $path }
    }
    throw "Docker CLI executable not found."
}

Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host "   LMS MEDICAL365 -- OFFLINE DOCKER IMAGE EXPORTER" -ForegroundColor Cyan
Write-Host "================================================================`n" -ForegroundColor Cyan

$docker = Get-DockerPath

# 1. Verify Docker Engine is running
try {
    & $docker info > $null 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Docker engine is offline." }
} catch {
    Write-Err "Docker daemon is not responding. Please ensure Docker Desktop is running."
    exit 1
}

# 2. Define exact required images from docker-compose.local.yml
$requiredImages = @(
    @{ Name = "mongo:7.0"; Service = "database"; Required = $true },
    @{ Name = "lms-medical365-backend:local"; Service = "backend"; Required = $true },
    @{ Name = "lms-medical365-frontend:local"; Service = "frontend"; Required = $true }
)

Write-Info "Verifying presence of required Docker images..."
$manifestImages = @()
$missingImages = @()

foreach ($img in $requiredImages) {
    $imgName = $img.Name
    $inspectJson = & $docker image inspect $imgName 2>&1
    if ($LASTEXITCODE -ne 0) {
        $missingImages += $imgName
        Write-Err "Missing required Docker image: $imgName"
    } else {
        $parsed = $inspectJson | ConvertFrom-Json
        $imgObj = $parsed[0]
        $sizeBytes = [int64]$imgObj.Size
        $sizeMB = [math]::Round($sizeBytes / 1MB, 2)
        Write-Success "Found: $imgName ($sizeMB MB, Arch: $($imgObj.Architecture), OS: $($imgObj.Os))"

        $manifestImages += [PSCustomObject]@{
            service = $img.Service
            repoTag = $imgName
            imageId = $imgObj.Id
            architecture = $imgObj.Architecture
            os = $imgObj.Os
            sizeBytes = $sizeBytes
            sizeMB = $sizeMB
            created = $imgObj.Created
        }
    }
}

if ($missingImages.Count -gt 0) {
    Write-Err "Cannot export offline bundle. Missing images: $($missingImages -join ', ')"
    exit 1
}

# 3. Prepare Output Directory
if (!(Test-Path $OutputDir)) {
    Write-Info "Creating output directory: $OutputDir"
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$tarPath = Join-Path $OutputDir $ArchiveName
$manifestPath = Join-Path $OutputDir "offline-images-manifest.json"
$checksumPath = Join-Path $OutputDir "offline-images.sha256"

if ((Test-Path $tarPath) -and !$Force) {
    Write-Warn "Archive already exists at: $tarPath"
    Write-Warn "Use -Force to overwrite existing export."
}

# 4. Execute docker save
Write-Info "Exporting images to TAR archive (This may take 1-3 minutes)..."
$imageNames = $requiredImages | ForEach-Object { $_.Name }
$saveCmd = "$docker save -o `"$tarPath`" " + ($imageNames -join " ")
Write-Info "Executing: $saveCmd"

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
& $docker save -o $tarPath $imageNames
if ($LASTEXITCODE -ne 0) {
    Write-Err "docker save command failed with exit code $LASTEXITCODE."
    exit 1
}
$stopwatch.Stop()
$elapsedSec = [math]::Round($stopwatch.Elapsed.TotalSeconds, 1)

$tarItem = Get-Item $tarPath
$tarSizeMB = [math]::Round($tarItem.Length / 1MB, 2)
$tarSizeGB = [math]::Round($tarItem.Length / 1GB, 3)
Write-Success "TAR archive created in $elapsedSec seconds: $tarPath ($tarSizeMB MB / $tarSizeGB GB)"

# 5. Compute SHA-256 Checksum
Write-Info "Computing SHA-256 cryptographic checksum..."
$hashResult = Get-FileHash -Path $tarPath -Algorithm SHA256
$sha256 = $hashResult.Hash.ToUpper()

# Save checksum in standard sha256sum format
$sha256Line = "$sha256  *$ArchiveName"
Set-Content -Path $checksumPath -Value $sha256Line -Encoding ASCII
Write-Success "Checksum saved: $checksumPath ($sha256)"

# 6. Generate Manifest JSON
Write-Info "Generating image manifest..."
$manifest = [PSCustomObject]@{
    manifestVersion = "1.0.0"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    lmsEdition = "local"
    archiveFilename = $ArchiveName
    sha256 = $sha256
    archiveSizeBytes = $tarItem.Length
    archiveSizeMB = $tarSizeMB
    archiveSizeGB = $tarSizeGB
    imagesCount = $manifestImages.Count
    images = $manifestImages
    integrityNotes = "Archive contains only standard OCI/Docker image layers. Zero patient data, database records, credentials, or volumes are contained."
}

$manifestJson = $manifest | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($manifestPath, $manifestJson, [System.Text.UTF8Encoding]::new($false))
Write-Success "Manifest saved: $manifestPath"

# 7. Verify Archive Integrity
Write-Info "Verifying archive integrity..."
if ($tarItem.Length -lt 100MB) {
    Write-Err "Archive size ($tarSizeMB MB) is unexpectedly small for 3 full images! Minimum expected > 100 MB."
    exit 1
}

$verifyHash = (Get-FileHash -Path $tarPath -Algorithm SHA256).Hash.ToUpper()
if ($verifyHash -ne $sha256) {
    Write-Err "Self-verification failed: Checksum mismatch on newly created archive!"
    exit 1
}

Write-Success "Archive integrity verified (SHA-256 matched, size: $tarSizeGB GB)."

Write-Host "`n----------------------------------------------------------------" -ForegroundColor Green
Write-Host " OFFLINE DOCKER IMAGE EXPORT COMPLETED SUCCESSFULLY" -ForegroundColor Green
Write-Host " Archive:  $tarPath" -ForegroundColor White
Write-Host " Manifest: $manifestPath" -ForegroundColor White
Write-Host " Checksum: $checksumPath" -ForegroundColor White
Write-Host "----------------------------------------------------------------`n" -ForegroundColor Green
