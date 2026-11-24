<#
.SYNOPSIS
    LMS Medical365 - Local Edition Service Starter
.DESCRIPTION
    Safely starts the LMS Medical365 Docker Compose stack (MongoDB, Backend, Frontend).
    Verifies container healthchecks, determines the central server LAN IP,
    and displays connection URLs for local and network workstations.
#>

[CmdletBinding()]
param(
    [switch]$Detach = $true,
    [int]$TimeoutSeconds = 60
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$ComposeFile = Join-Path $RootDir "docker-compose.local.yml"
$EnvFile = Join-Path $RootDir "docker\local.env"

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Success($msg) { Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }

# 1. Locate Docker Executable
function Get-DockerPath {
    if (Get-Command docker -ErrorAction SilentlyContinue) { return "docker" }
    $candidates = @(
        "$env:ProgramFiles\Docker\Docker\resources\bin\docker.exe",
        "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe"
    )
    foreach ($path in $candidates) {
        if (Test-Path $path) { return $path }
    }
    throw "Docker CLI executable not found. Please ensure Docker Desktop is installed and running."
}

# 2. Identify Central Server LAN IP
function Get-CentralServerIp {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { 
        $_.IPAddress -ne '127.0.0.1' -and 
        $_.InterfaceAlias -notmatch 'vEthernet|Loopback' -and 
        $_.IPAddress -notmatch '^169\.254\.'
    } | Select-Object -ExpandProperty IPAddress -First 1
    if (!$ip) { $ip = "127.0.0.1" }
    return $ip
}

Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host "   LMS MEDICAL365 -- LOCAL EDITION SERVICE LAUNCHER" -ForegroundColor Cyan
Write-Host "================================================================`n" -ForegroundColor Cyan

$docker = Get-DockerPath
Write-Info "Docker CLI detected: $docker"

# Verify Docker daemon is responsive
try {
    & $docker info > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker engine is not responding. Please launch Docker Desktop."
    }
} catch {
    Write-Err "Docker engine is offline. Please start Docker Desktop and retry."
    exit 1
}

# Verify Compose file exists
if (!(Test-Path $ComposeFile)) {
    Write-Err "docker-compose.local.yml not found at: $ComposeFile"
    exit 1
}

# Ensure local.env exists (auto-copy from example if first run)
if (!(Test-Path $EnvFile)) {
    $ExampleEnv = Join-Path $RootDir "docker\local.env.example"
    if (Test-Path $ExampleEnv) {
        Write-Warn "docker/local.env not found. Initializing from local.env.example..."
        Copy-Item -Path $ExampleEnv -Destination $EnvFile
    } else {
        Write-Err "Configuration file docker/local.env is missing!"
        exit 1
    }
}

# Ensure deterministic host machine fingerprint is generated and persisted
$fpScript = Join-Path $RootDir "scripts\get-machine-fingerprint.ps1"
if (Test-Path $fpScript) {
    try {
        & powershell -ExecutionPolicy Bypass -File $fpScript -Quiet
    } catch {}
}

Write-Info "Starting LMS Medical365 containers..."
& $docker compose -f $ComposeFile --env-file $EnvFile up -d

if ($LASTEXITCODE -ne 0) {
    Write-Err "Failed to start containers via Docker Compose."
    exit 1
}

Write-Info "Waiting for containers to report healthy status (Timeout: ${TimeoutSeconds}s)..."
$startTime = Get-Date
$allHealthy = $false

while (((Get-Date) - $startTime).TotalSeconds -lt $TimeoutSeconds) {
    Start-Sleep -Seconds 3
    $statuses = & $docker ps --filter "name=lms_local_" --format "{{.Names}}: {{.Status}}"
    $healthyCount = 0
    foreach ($s in $statuses) {
        if ($s -match "healthy") { $healthyCount++ }
    }
    
    if ($healthyCount -ge 3) {
        $allHealthy = $true
        break
    }
    Write-Host "." -NoNewline -ForegroundColor Gray
}

Write-Host ""
if ($allHealthy) {
    $lanIp = Get-CentralServerIp
    Write-Success "All LMS Medical365 services are healthy and online!"
    Write-Host "`n----------------------------------------------------------------" -ForegroundColor Green
    Write-Host " Central Server Localhost: http://localhost" -ForegroundColor White
    Write-Host " Network LAN Access URL:   http://$lanIp" -ForegroundColor Yellow
    Write-Host " Health Probe Endpoint:    http://$lanIp/api/health" -ForegroundColor White

    try {
        $licRes = Invoke-RestMethod -Uri "http://127.0.0.1/api/v1/system/license" -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($licRes -and $licRes.data) {
            $lic = $licRes.data
            Write-Host " License Status:           $($lic.status)" -ForegroundColor $(if ($lic.isValid) { "Green" } else { "Yellow" })
            Write-Host " Machine Fingerprint:      $($lic.machineFingerprint)" -ForegroundColor Cyan
            if ($lic.isReadOnly) {
                Write-Host " [NOTICE] LMS is in Read-Only Mode. Activate write access via web portal or Manage Console Option [8]" -ForegroundColor Yellow
            }
        }
    } catch {}

    Write-Host "----------------------------------------------------------------" -ForegroundColor Green
    Write-Info "Staff on Computer 2 and Computer 3 can now open: http://$lanIp`n"
} else {
    Write-Warn "Containers started, but some health checks are still pending."
    Write-Info "Check status anytime with: .\scripts\status-lms.ps1`n"
}
