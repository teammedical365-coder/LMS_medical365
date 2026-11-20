<#
.SYNOPSIS
    LMS Medical365 - Local Edition Service Status Inspector
.DESCRIPTION
    Inspects Docker container states, healthcheck results, port exposure isolation,
    and HTTP API responsiveness for LMS Medical365 Local Edition.
#>

[CmdletBinding()]
param()

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Success($msg) { Write-Host "[OK]   $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red }

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

function Get-CentralServerIp {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { 
        $_.IPAddress -ne '127.0.0.1' -and 
        $_.InterfaceAlias -notmatch 'vEthernet|Loopback' -and 
        $_.IPAddress -notmatch '^169\.254\.'
    } | Select-Object -ExpandProperty IPAddress -First 1
    if (-not $ip) { $ip = "127.0.0.1" }
    return $ip
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "   LMS MEDICAL365 -- SERVICE STATUS AND HEALTH REPORT" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$docker = Get-DockerPath
if (-not $docker) {
    Write-Err "Docker CLI executable not found on host."
    exit 1
}

# 1. Docker Engine Check
try {
    & $docker info *>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Docker engine daemon is offline or not responding."
        exit 1
    }
    Write-Success "Docker Engine is active and operational."
} catch {
    Write-Err "Docker engine check failed: $_"
    exit 1
}

# 2. Container Health Inspection
$expectedContainers = @("lms_local_mongo", "lms_local_backend", "lms_local_frontend")
$allHealthy = $true

Write-Host ""
Write-Host "Container Statuses:" -ForegroundColor White
Write-Host "-------------------" -ForegroundColor Gray

foreach ($cName in $expectedContainers) {
    $inspectJson = & $docker inspect $cName 2>$null
    if (-not $inspectJson) {
        Write-Err "${cName}: NOT FOUND / NOT RUNNING"
        $allHealthy = $false
        continue
    }

    $cData = $inspectJson | ConvertFrom-Json
    $state = $cData[0].State.Status
    $health = if ($cData[0].State.Health) { $cData[0].State.Health.Status } else { $null }

    if ($state -eq "running" -and ($health -eq "healthy" -or -not $health)) {
        $healthTag = if ($health) { "($health)" } else { "(no healthcheck)" }
        Write-Success "${cName}: RUNNING $healthTag"
    } else {
        $healthTag = if ($health) { "($health)" } else { "" }
        Write-Err "${cName}: $state $healthTag"
        $allHealthy = $false
    }
}

# 3. Port Isolation Verification (SEC-LOCAL-01 and SEC-LOCAL-02)
Write-Host ""
Write-Host "Port Exposure and Security Isolation:" -ForegroundColor White
Write-Host "------------------------------------" -ForegroundColor Gray

$fePorts = & $docker port lms_local_frontend 2>$null
$bePorts = & $docker port lms_local_backend 2>$null
$mgPorts = & $docker port lms_local_mongo 2>$null

if ($fePorts -match "80") {
    Write-Success "Frontend port 80 is bound to host ($fePorts)"
} else {
    Write-Warn "Frontend port 80 is not detected on host."
}

if (-not $bePorts) {
    Write-Success "Backend port 5000 is INTERNAL ONLY (Isolated from LAN)"
} else {
    Write-Warn "Backend port exposure detected: $bePorts"
}

if (-not $mgPorts) {
    Write-Success "MongoDB port 27017 is INTERNAL ONLY (Isolated from LAN)"
} else {
    Write-Warn "MongoDB port exposure detected: $mgPorts"
}

# 4. HTTP API Health Probe
Write-Host ""
Write-Host "HTTP API Endpoint Health Probe:" -ForegroundColor White
Write-Host "-------------------------------" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1/api/health" -Method Get -TimeoutSec 5 -ErrorAction Stop
    if ($response.status -eq "success" -or $response.data.status -eq "healthy") {
        Write-Success "HTTP GET http://127.0.0.1/api/health responded with 200 OK (API healthy)"
    } else {
        Write-Warn "HTTP API responded but reported status: $($response.status)"
    }
} catch {
    Write-Err "HTTP health probe to http://127.0.0.1/api/health failed: $_"
    $allHealthy = $false
}

# 5. LAN Access Information
$lanIp = Get-CentralServerIp
Write-Host ""
Write-Host "Network Access Coordinates:" -ForegroundColor White
Write-Host "---------------------------" -ForegroundColor Gray
Write-Host "  Central Server Local:   http://localhost" -ForegroundColor Cyan
Write-Host "  LAN Workstations URL:   http://${lanIp}" -ForegroundColor Cyan
Write-Host "  API Health Endpoint:    http://${lanIp}/api/health" -ForegroundColor Gray

Write-Host ""
if ($allHealthy) {
    Write-Success "All LMS Medical365 Local Edition services are healthy and operational."
    Write-Host ""
    exit 0
} else {
    Write-Warn "One or more LMS Medical365 components are degraded or offline."
    Write-Host ""
    exit 1
}
