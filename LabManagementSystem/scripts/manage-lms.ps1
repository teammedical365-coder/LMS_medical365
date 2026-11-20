<#
.SYNOPSIS
    LMS Medical365 - Local Edition Operations Control Console
.DESCRIPTION
    Interactive management launcher for lab administrators and IT support.
    Provides one-click operations for start, stop, restart, backup, restore,
    licensing inspection, updates, and browser portal launch.
#>

[CmdletBinding()]
param()

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

function Get-CentralServerIp {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { 
        $_.IPAddress -ne '127.0.0.1' -and 
        $_.InterfaceAlias -notmatch 'vEthernet|Loopback' -and 
        $_.IPAddress -notmatch '^169\.254\.'
    } | Select-Object -ExpandProperty IPAddress -First 1
    if (!$ip) { $ip = "127.0.0.1" }
    return $ip
}

function Show-Header {
    Clear-Host
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host "       LMS MEDICAL365 -- LOCAL ON-PREMISE MANAGEMENT CONSOLE" -ForegroundColor Cyan
    Write-Host "================================================================================" -ForegroundColor Cyan
    $lanIp = Get-CentralServerIp
    Write-Host " Central Server LAN IP: " -NoNewline -ForegroundColor Gray
    Write-Host "$lanIp" -ForegroundColor Yellow
    Write-Host " Web Portal Access URL: " -NoNewline -ForegroundColor Gray
    Write-Host "http://$lanIp" -ForegroundColor Green
    Write-Host "--------------------------------------------------------------------------------`n" -ForegroundColor Gray
}

function Pause-Console {
    Write-Host "`nPress Enter to return to main menu..." -ForegroundColor DarkGray
    [void][System.Console]::ReadLine()
}

$running = $true

while ($running) {
    Show-Header
    Write-Host "  [1]  Inspect System Status and Container Health" -ForegroundColor White
    Write-Host "  [2]  Start LMS Services" -ForegroundColor White
    Write-Host "  [3]  Stop LMS Services (Graceful Shutdown)" -ForegroundColor White
    Write-Host "  [4]  Restart LMS Services" -ForegroundColor White
    Write-Host "  [5]  Create Full Database Backup" -ForegroundColor White
    Write-Host "  [6]  List Available Database Backups" -ForegroundColor White
    Write-Host "  [7]  Restore Database from Backup Snapshot" -ForegroundColor White
    Write-Host "  [8]  View Offline License and Features Status" -ForegroundColor White
    Write-Host "  [9]  Run Safe Application Update" -ForegroundColor White
    Write-Host "  [10] Open LMS Web Portal in Browser" -ForegroundColor White
    Write-Host "  [0]  Exit" -ForegroundColor Gray
    Write-Host ""
    $choice = Read-Host "Select an option [0-10]"

    switch ($choice) {
        "1" {
            & powershell -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "status-lms.ps1")
            Pause-Console
        }
        "2" {
            & powershell -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "start-lms.ps1")
            Pause-Console
        }
        "3" {
            & powershell -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "stop-lms.ps1")
            Pause-Console
        }
        "4" {
            & powershell -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "restart-lms.ps1")
            Pause-Console
        }
        "5" {
            & powershell -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "backup-lms.ps1")
            Pause-Console
        }
        "6" {
            & powershell -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "backup-lms.ps1") -List
            Pause-Console
        }
        "7" {
            & powershell -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "restore-lms.ps1")
            Pause-Console
        }
        "8" {
            Write-Host "`nQuerying License Status..." -ForegroundColor Cyan
            try {
                $lic = (Invoke-RestMethod -Uri "http://127.0.0.1/api/v1/system/license" -TimeoutSec 5).data
                Write-Host "Status:            " -NoNewline; Write-Host $lic.status -ForegroundColor Green
                Write-Host "Customer:          $($lic.customer.name)" -ForegroundColor White
                Write-Host "Lab Code:          $($lic.customer.labCode)" -ForegroundColor White
                Write-Host "Edition:           $($lic.edition)" -ForegroundColor White
                Write-Host "Days Remaining:    " -NoNewline; Write-Host "$($lic.daysRemaining) days" -ForegroundColor Yellow
                Write-Host "Expires At:        $($lic.expiresAt)" -ForegroundColor Gray
                Write-Host "Read-Only Mode:    $($lic.isReadOnly)" -ForegroundColor $(if ($lic.isReadOnly) { "Red" } else { "Green" })
                Write-Host "Enabled Features:  $($lic.features -join ', ')" -ForegroundColor Cyan
                Write-Host "Hardware ID:       $($lic.machineFingerprint)" -ForegroundColor Gray
            } catch {
                Write-Host "Failed to query license endpoint. Ensure services are running." -ForegroundColor Red
            }
            Pause-Console
        }
        "9" {
            & powershell -ExecutionPolicy Bypass -File (Join-Path $ScriptDir "update-lms.ps1")
            Pause-Console
        }
        "10" {
            $lanIp = Get-CentralServerIp
            $portalUrl = "http://$lanIp"
            Write-Host "`nOpening $portalUrl in your default browser..." -ForegroundColor Green
            Start-Process $portalUrl
            Start-Sleep -Seconds 1
        }
        "0" {
            $running = $false
            Write-Host "`nExiting LMS Management Console. Have a great day!`n" -ForegroundColor Cyan
        }
        default {
            Write-Host "`nInvalid selection. Please choose a number between 0 and 10." -ForegroundColor Red
            Start-Sleep -Seconds 1
        }
    }
}
