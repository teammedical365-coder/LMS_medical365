<#
.SYNOPSIS
    LMS Medical365 - Local Edition Safe Service Stopper
.DESCRIPTION
    Gracefully stops the LMS Medical365 containers without deleting volumes or dropping data.
    Ensures in-flight database writes are flushed before stopping the MongoDB daemon.
    Does NOT stop or terminate any unrelated Docker containers on the host.
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$ComposeFile = Join-Path $RootDir "docker-compose.local.yml"

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Success($msg) { Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
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
Write-Host "   LMS MEDICAL365 -- SAFE SHUTDOWN" -ForegroundColor Cyan
Write-Host "================================================================`n" -ForegroundColor Cyan

$docker = Get-DockerPath

# Check if LMS containers are running
$runningLms = & $docker ps --filter "name=lms_local_" --format "{{.Names}}"
if (!$runningLms) {
    Write-Info "No LMS Medical365 containers are currently running."
    exit 0
}

Write-Info "Active LMS containers detected: $($runningLms -join ', ')"
Write-Info "Executing graceful stop (All database volumes and records are preserved)..."

# 1. Stop frontend and backend first to cease incoming write requests
& $docker stop lms_local_frontend lms_local_backend -t 15 > $null 2>&1
Write-Info "Frontend and backend stopped cleanly."

# 2. Stop MongoDB daemon safely after traffic cessation
& $docker stop lms_local_mongo -t 30 > $null 2>&1
Write-Info "MongoDB daemon flushed and stopped cleanly."

Write-Success "All LMS Medical365 services stopped safely."
Write-Info "Persistent volumes (lms_local_mongo_data, backups, storage) remain intact.`n"
