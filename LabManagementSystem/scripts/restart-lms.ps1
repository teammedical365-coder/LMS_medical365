<#
.SYNOPSIS
    LMS Medical365 - Local Edition Safe Service Restarter
.DESCRIPTION
    Gracefully restarts the LMS Medical365 Docker Compose stack.
    Calls stop-lms.ps1 to flush MongoDB data buffers cleanly,
    then calls start-lms.ps1 to launch services and verify healthchecks.
#>

[CmdletBinding()]
param(
    [int]$TimeoutSeconds = 60,
    [switch]$Force = $false
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$StopScript = Join-Path $ScriptDir "stop-lms.ps1"
$StartScript = Join-Path $ScriptDir "start-lms.ps1"

Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host "   LMS MEDICAL365 -- RESTARTING SERVICES" -ForegroundColor Cyan
Write-Host "================================================================`n" -ForegroundColor Cyan

# 1. Stop running services gracefully
if (Test-Path $StopScript) {
    & $StopScript
} else {
    Write-Host "[ERROR] stop-lms.ps1 not found at: $StopScript" -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] Waiting 3 seconds for port release and file handle closure..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

# 2. Start services and verify health status
if (Test-Path $StartScript) {
    & $StartScript -TimeoutSeconds $TimeoutSeconds
} else {
    Write-Host "[ERROR] start-lms.ps1 not found at: $StartScript" -ForegroundColor Red
    exit 1
}
