<#
.SYNOPSIS
    LMS Medical365 - Local Edition Safe Database Restore Utility
.DESCRIPTION
    Safely restores lms_master and tenant databases from a verified BSON backup snapshot.
    Enforces manifest validation, SHA-256 integrity checks, automatic pre-restore
    safety snapshots, and mandatory confirmation token (RESTORE-CONFIRM).
#>

[CmdletBinding()]
param(
    [string]$BackupId = "",
    [string]$BackupPath = "",
    [string]$ConfirmToken = "",
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$HostBackupBase = Join-Path $RootDir "backups\lms"

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

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "   LMS MEDICAL365 -- SAFE RESTORE UTILITY" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Identify Target Backup Path
$targetBackupDir = ""
if ($BackupPath -and (Test-Path $BackupPath)) {
    $targetBackupDir = $BackupPath
} elseif ($BackupId) {
    $candidate = Join-Path $HostBackupBase $BackupId
    if (Test-Path $candidate) {
        $targetBackupDir = $candidate
    }
}

if (-not $targetBackupDir) {
    Write-Info "Scanning for available backups in: $HostBackupBase"
    $backups = Get-ChildItem -Path $HostBackupBase -Filter "manifest.json" -Recurse -Depth 2
    if (-not $backups -or $backups.Count -eq 0) {
        Write-Err "No backups found in $HostBackupBase"
        exit 1
    }

    Write-Host ""
    Write-Host "Available Backups:" -ForegroundColor White
    $idx = 1
    $backupList = @()
    foreach ($b in $backups) {
        $dir = $b.DirectoryName
        $leaf = Split-Path $dir -Leaf
        try {
            $manifest = Get-Content $b.FullName -Raw | ConvertFrom-Json
            Write-Host "  [$idx] $leaf | Created: $($manifest.createdAt) | DBs: $($manifest.summary.totalDatabases) | Docs: $($manifest.summary.totalDocuments)" -ForegroundColor Cyan
            $backupList += $dir
            $idx++
        } catch {}
    }

    $selection = Read-Host "`nSelect backup number to restore (1-$($backupList.Count))"
    $selIndex = [int]$selection - 1
    if ($selIndex -lt 0 -or $selIndex -ge $backupList.Count) {
        Write-Err "Invalid selection."
        exit 1
    }
    $targetBackupDir = $backupList[$selIndex]
}

Write-Info "Selected backup directory: $targetBackupDir"
$manifestPath = Join-Path $targetBackupDir "manifest.json"
if (-not (Test-Path $manifestPath)) {
    Write-Err "manifest.json not found in backup directory."
    exit 1
}

# 2. Mandatory Confirmation Check
if (-not $DryRun) {
    if ($ConfirmToken -ne "RESTORE-CONFIRM") {
        Write-Host ""
        Write-Warn "CRITICAL SAFETY WARNING:"
        Write-Warn "Restoring will replace existing clinical records and platform configuration."
        Write-Warn "An automated pre-restore safety snapshot will be created before any changes."
        Write-Host "To confirm, type exactly: " -NoNewline -ForegroundColor Yellow
        Write-Host "RESTORE-CONFIRM" -ForegroundColor Red
        $inputToken = Read-Host "Enter confirmation"
        if ($inputToken -ne "RESTORE-CONFIRM") {
            Write-Err "Restore aborted. Confirmation token did not match."
            exit 1
        }
    }
}

# 3. Execution
$docker = Get-DockerPath
$containerRunning = $false

if ($docker) {
    $inspect = & $docker inspect lms_local_backend 2>$null
    if ($inspect) {
        $cData = $inspect | ConvertFrom-Json
        if ($cData[0].State.Status -eq "running") {
            $containerRunning = $true
        }
    }
}

$folderLeaf = Split-Path $targetBackupDir -Leaf

if ($containerRunning) {
    Write-Info "Ensuring backup archive exists inside container storage..."
    & $docker cp $targetBackupDir "lms_local_backend:/app/backups/$folderLeaf"

    $restoreArgs = @("scripts/run-restore.js", "--backup=/app/backups/$folderLeaf")
    if ($DryRun) {
        $restoreArgs += "--dry-run"
    } else {
        $restoreArgs += "--confirm=RESTORE-CONFIRM"
    }

    $cmd = "node " + ($restoreArgs -join ' ')
    Write-Info "Executing safe restore inside container..."
    & $docker exec lms_local_backend sh -c $cmd
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Restore failed inside Docker container."
        exit 1
    }
} else {
    Write-Warn "lms_local_backend container is offline. Attempting local Node execution..."
    Push-Location (Join-Path $RootDir "server")
    try {
        $argsList = @("scripts/run-restore.js", "--backup=$targetBackupDir")
        if ($DryRun) {
            $argsList += "--dry-run"
        } else {
            $argsList += "--confirm=RESTORE-CONFIRM"
        }
        & node $argsList
        if ($LASTEXITCODE -ne 0) {
            Write-Err "Restore execution failed."
            exit 1
        }
    } finally {
        Pop-Location
    }
}

Write-Host ""
Write-Success "LMS Medical365 safe restore operation completed successfully."
Write-Host ""
