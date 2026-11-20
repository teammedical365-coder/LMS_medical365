<#
.SYNOPSIS
    LMS Medical365 - Offline Docker Image Loader
.DESCRIPTION
    Loads the pre-packaged Local Edition Docker images (mongo:7.0, backend, frontend)
    from an offline TAR archive into the local Docker daemon.
    Verifies archive presence and SHA-256 cryptographic checksum prior to loading.
    Confirms all required image tags are available post-load.
    NEVER deletes existing containers, images, or volumes.
    NEVER executes docker prune.
#>

[CmdletBinding()]
param(
    [string]$ArchivePath = "",
    [string]$ChecksumPath = "",
    [switch]$SkipChecksum = $false
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

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
Write-Host "   LMS MEDICAL365 -- OFFLINE DOCKER IMAGE LOADER" -ForegroundColor Cyan
Write-Host "================================================================`n" -ForegroundColor Cyan

$docker = Get-DockerPath

# 1. Check Docker Daemon Readiness
Write-Info "Verifying Docker engine readiness..."
try {
    & $docker info > $null 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Docker engine is offline." }
    Write-Success "Docker daemon is active and responsive."
} catch {
    Write-Err "Docker Desktop is not running or not responding."
    Write-Err "Please start Docker Desktop and wait for the whale icon before loading images."
    exit 1
}

# 2. Locate Archive File
if ([string]::IsNullOrWhiteSpace($ArchivePath)) {
    # Search common locations
    $candidates = @(
        (Join-Path $RootDir "installer_dist\LMS_Medical365_Offline_Images_v1.0.0.tar"),
        (Join-Path $RootDir "images\LMS_Medical365_Offline_Images_v1.0.0.tar"),
        (Join-Path $RootDir "LMS_Medical365_Offline_Images_v1.0.0.tar"),
        (Join-Path $ScriptDir "..\installer_dist\LMS_Medical365_Offline_Images_v1.0.0.tar")
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) {
            $ArchivePath = $c
            break
        }
    }
}

if ([string]::IsNullOrWhiteSpace($ArchivePath) -or !(Test-Path $ArchivePath)) {
    Write-Err "Offline image archive not found!"
    Write-Err "Expected archive file: LMS_Medical365_Offline_Images_v1.0.0.tar"
    Write-Err "Please ensure the archive is located in the installer_dist or images directory."
    exit 1
}

$tarItem = Get-Item $ArchivePath
$sizeMB = [math]::Round($tarItem.Length / 1MB, 2)
$sizeGB = [math]::Round($tarItem.Length / 1GB, 3)
Write-Info "Archive located: $ArchivePath ($sizeMB MB / $sizeGB GB)"

# 3. Locate Checksum File and Verify Cryptographic Hash
if (!$SkipChecksum) {
    if ([string]::IsNullOrWhiteSpace($ChecksumPath)) {
        $archiveDir = Split-Path -Parent $ArchivePath
        $possibleChecksums = @(
            (Join-Path $archiveDir "offline-images.sha256"),
            (Join-Path $archiveDir "offline-images-manifest.json")
        )
        foreach ($p in $possibleChecksums) {
            if (Test-Path $p) {
                $ChecksumPath = $p
                break
            }
        }
    }

    if (![string]::IsNullOrWhiteSpace($ChecksumPath) -and (Test-Path $ChecksumPath)) {
        Write-Info "Verifying SHA-256 checksum against: $ChecksumPath..."
        $expectedHash = $null

        if ($ChecksumPath -like "*.sha256") {
            $firstLine = (Get-Content -Path $ChecksumPath -TotalCount 1).Trim()
            if ($firstLine -match '^([A-Fa-f0-9]{64})') {
                $expectedHash = $matches[1].ToUpper()
            }
        } elseif ($ChecksumPath -like "*.json") {
            try {
                $manifestObj = Get-Content -Path $ChecksumPath -Raw | ConvertFrom-Json
                if ($manifestObj.sha256) {
                    $expectedHash = $manifestObj.sha256.ToUpper()
                }
            } catch {
                Write-Warn "Could not parse manifest JSON for checksum verification."
            }
        }

        if ($expectedHash) {
            $actualHash = (Get-FileHash -Path $ArchivePath -Algorithm SHA256).Hash.ToUpper()
            if ($actualHash -ne $expectedHash) {
                Write-Err "CHECKSUM VERIFICATION FAILED!"
                Write-Err "Expected SHA-256: $expectedHash"
                Write-Err "Actual SHA-256:   $actualHash"
                Write-Err "The offline archive may be corrupted or truncated. Aborting image load."
                exit 1
            }
            Write-Success "SHA-256 checksum verified: $actualHash"
        } else {
            Write-Warn "Could not extract SHA-256 hash from $ChecksumPath. Skipping hash check."
        }
    } else {
        Write-Warn "No checksum file found. Proceeding with caution."
    }
} else {
    Write-Warn "Skipping SHA-256 checksum verification (-SkipChecksum specified)."
}

# 4. Check if Required Images Are Already Present
$requiredTags = @("mongo:7.0", "lms-medical365-backend:local", "lms-medical365-frontend:local")
$allPresent = $true
foreach ($tag in $requiredTags) {
    & $docker image inspect $tag > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        $allPresent = $false
        break
    }
}

if ($allPresent) {
    Write-Info "All required LMS images are already loaded in Docker daemon:"
    foreach ($tag in $requiredTags) {
        Write-Host "   - $tag (Present)" -ForegroundColor Green
    }
    Write-Info "Refreshing / re-loading images from archive to guarantee exact build match..."
}

# 5. Execute docker load
Write-Info "Loading Docker images from archive (This may take 1-3 minutes)..."
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

$loadOutput = & $docker load -i $ArchivePath 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Err "docker load failed with exit code $($LASTEXITCODE):"
    $loadOutput | ForEach-Object { Write-Err "  $_" }
    exit 1
}
$stopwatch.Stop()
$elapsedSec = [math]::Round($stopwatch.Elapsed.TotalSeconds, 1)

Write-Success "docker load completed in $elapsedSec seconds."
$loadOutput | ForEach-Object {
    if ($_ -match "Loaded image") {
        Write-Host "  $_" -ForegroundColor Green
    }
}

# 6. Verify Post-Load Image Tags
Write-Info "Verifying loaded image tags in local Docker repository..."
$missingTags = @()
foreach ($tag in $requiredTags) {
    & $docker image inspect $tag > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        $missingTags += $tag
        Write-Err "Image tag missing after load: $tag"
    } else {
        Write-Success "Verified in Docker: $tag"
    }
}

if ($missingTags.Count -gt 0) {
    Write-Err "Image loading verification failed! Missing tags: $($missingTags -join ', ')"
    exit 1
}

Write-Host "`n----------------------------------------------------------------" -ForegroundColor Green
Write-Host " ALL REQUIRED OFFLINE LMS DOCKER IMAGES SUCCESSFULLY LOADED" -ForegroundColor Green
Write-Host " Ready for air-gapped service startup via start-lms.ps1" -ForegroundColor White
Write-Host "----------------------------------------------------------------`n" -ForegroundColor Green
exit 0
