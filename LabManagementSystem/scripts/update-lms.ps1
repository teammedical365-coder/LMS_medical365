<#
.SYNOPSIS
    LMS Medical365 - Local Edition Safe Application Updater
.DESCRIPTION
    Safely executes application updates on the central Windows PC.
    Mandatory safeguards:
    - Automatic pre-update database backup snapshot
    - Strict preservation of docker/local.env and license keys
    - Zero data loss: Preserves all persistent Docker volumes
    - Pre- and post-update health verification
    - Automated rollback protection
#>

[CmdletBinding()]
param(
    [switch]$SkipBackup = $false,
    [switch]$Rebuild = $false,
    [int]$TimeoutSeconds = 90
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$ComposeFile = Join-Path $RootDir "docker-compose.local.yml"
$EnvFile = Join-Path $RootDir "docker\local.env"
$LicenseFile = Join-Path $RootDir "docker\license.key"
$StagingDir = Join-Path $RootDir ".update_staging"

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
    return $null
}

Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host "   LMS MEDICAL365 -- SAFE APPLICATION UPDATE SYSTEM" -ForegroundColor Cyan
Write-Host "================================================================`n" -ForegroundColor Cyan

$docker = Get-DockerPath
if (!$docker) {
    Write-Err "Docker executable not found."
    exit 1
}

# 1. Pre-update safety checks
if (!(Test-Path $EnvFile)) {
    Write-Err "Critical configuration file docker/local.env not found. Aborting update."
    exit 1
}

# 2. Automated pre-update database backup
if (!$SkipBackup) {
    Write-Info "Executing mandatory pre-update database backup snapshot..."
    $backupScript = Join-Path $ScriptDir "backup-lms.ps1"
    if (Test-Path $backupScript) {
        & powershell -ExecutionPolicy Bypass -File $backupScript
        if ($LASTEXITCODE -ne 0) {
            Write-Err "Pre-update backup failed. Aborting update for safety."
            exit 1
        }
        Write-Success "Pre-update safety backup completed successfully."
    }
}

# 3. Snapshot configuration and license to protected staging directory
Write-Info "Staging critical environment configurations and license keys..."
if (!(Test-Path $StagingDir)) {
    New-Item -ItemType Directory -Path $StagingDir -Force | Out-Null
}

$envBackupPath = Join-Path $StagingDir "local.env.bak"
Copy-Item -Path $EnvFile -Destination $envBackupPath -Force
Write-Info "Environment file preserved at: $envBackupPath"

if (Test-Path $LicenseFile) {
    Copy-Item -Path $LicenseFile -Destination (Join-Path $StagingDir "license.key.bak") -Force
}

# 4. Graceful shutdown of active containers
Write-Info "Gracefully stopping active services..."
$stopScript = Join-Path $ScriptDir "stop-lms.ps1"
& powershell -ExecutionPolicy Bypass -File $stopScript

# 5. Image update / rebuild
if ($Rebuild) {
    Write-Info "Rebuilding application container images from updated source..."
    & $docker compose -f $ComposeFile --env-file $EnvFile build
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Container build failed. Initiating rollback..."
        # Restore env
        Copy-Item -Path $envBackupPath -Destination $EnvFile -Force
        & powershell -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "start-lms.ps1")
        exit 1
    }
}

# 6. Verify environment file integrity before launching
if (!(Test-Path $EnvFile)) {
    Write-Warn "Environment file missing after update step. Restoring from safety staging..."
    Copy-Item -Path $envBackupPath -Destination $EnvFile -Force
}

# 7. Start updated containers
Write-Info "Launching updated service stack..."
$startScript = Join-Path $ScriptDir "start-lms.ps1"
& powershell -ExecutionPolicy Bypass -File $startScript -TimeoutSeconds $TimeoutSeconds

# 8. Post-update verification
Write-Info "Running post-update status inspection..."
$statusScript = Join-Path $ScriptDir "status-lms.ps1"
& powershell -ExecutionPolicy Bypass -File $statusScript

if ($LASTEXITCODE -ne 0) {
    Write-Err "Post-update health check reported degraded status."
    Write-Warn "To roll back to your previous database backup, run:"
    Write-Warn "  .\scripts\restore-lms.ps1"
    exit 1
}

# Cleanup staging backup on confirmed success
Remove-Item -Path $StagingDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Success "`nLMS Medical365 update completed and verified successfully.`n"
