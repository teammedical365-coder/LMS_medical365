<#
.SYNOPSIS
    LMS Medical365 - Host Machine Fingerprint Generator (Windows 10 / Windows 11)
.DESCRIPTION
    Computes a deterministic, hardware-bound machine fingerprint for Medical365 LMS.
    Combines Windows MachineGuid and Motherboard/System UUID to guarantee stability
    across Windows restarts, WSL2/Docker restarts, and container recreations.
    Persists the fingerprint to:
      - docker\machine.id
      - storage\machine.id
      - docker\local.env (LMS_MACHINE_FINGERPRINT)
#>

[CmdletBinding()]
param(
    [switch]$Quiet = $false,
    [switch]$NoSave = $false
)

$ErrorActionPreference = "SilentlyContinue"

# 1. Retrieve Windows Cryptography MachineGuid
$machineGuid = ""
try {
    $reg = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Cryptography" -Name "MachineGuid" -ErrorAction SilentlyContinue
    if ($reg -and $reg.MachineGuid) {
        $machineGuid = $reg.MachineGuid.ToString().Trim()
    }
} catch {}

if (!$machineGuid) {
    try {
        $regOutput = & reg query "HKLM\SOFTWARE\Microsoft\Cryptography" /v MachineGuid 2>$null
        foreach ($line in $regOutput) {
            if ($line -match "MachineGuid\s+REG_SZ\s+(\S+)") {
                $machineGuid = $matches[1].Trim()
                break
            }
        }
    } catch {}
}

# 2. Retrieve Motherboard / System UUID via CIM/WMI
$systemUuid = ""
try {
    $csProduct = Get-CimInstance -ClassName Win32_ComputerSystemProduct -ErrorAction SilentlyContinue
    if ($csProduct -and $csProduct.UUID) {
        $systemUuid = $csProduct.UUID.ToString().Trim()
    }
} catch {}

if (!$systemUuid) {
    try {
        $wmicOutput = & wmic csproduct get uuid 2>$null
        foreach ($line in $wmicOutput) {
            $trimmed = $line.Trim()
            if ($trimmed -and $trimmed -ne "UUID") {
                $systemUuid = $trimmed
                break
            }
        }
    } catch {}
}

# 3. Fallback to Primary Network MAC if UUID is unavailable or generic
$fallbackMac = ""
try {
    $nics = Get-CimInstance -ClassName Win32_NetworkAdapterConfiguration -Filter "IPEnabled = True" -ErrorAction SilentlyContinue
    foreach ($nic in $nics) {
        if ($nic.MACAddress -and $nic.MACAddress -ne "00:00:00:00:00:00") {
            $fallbackMac = $nic.MACAddress.Replace(":", "").Replace("-", "").ToLower().Trim()
            break
        }
    }
} catch {}

# 4. Construct Deterministic Seed String
$seedParts = @("LMS-MED365")
if ($machineGuid) { $seedParts += "GUID:$machineGuid" }
if ($systemUuid)  { $seedParts += "UUID:$systemUuid" }

# Fallback only if hardware UUID and MachineGuid are both unavailable
if ($seedParts.Count -le 1) {
    if ($fallbackMac) {
        $seedParts += "MAC:$fallbackMac"
    } else {
        $seedParts += "ENV:$($env:COMPUTERNAME)|$($env:PROCESSOR_IDENTIFIER)"
    }
}

$identityString = ($seedParts -join "|").ToLower()

# 5. Compute SHA-256 (32 hex characters)
$sha = [System.Security.Cryptography.SHA256]::Create()
$bytes = [System.Text.Encoding]::UTF8.GetBytes($identityString)
$hashBytes = $sha.ComputeHash($bytes)
$hexBuilder = New-Object System.Text.StringBuilder
foreach ($b in $hashBytes) {
    [void]$hexBuilder.Append($b.ToString("x2"))
}
$fingerprint = $hexBuilder.ToString().Substring(0, 32)

# 6. Save Fingerprint to Disk and Environment if requested
if (!$NoSave) {
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $RootDir = Split-Path -Parent $ScriptDir
    
    $dockerDir = Join-Path $RootDir "docker"
    $storageDir = Join-Path $RootDir "storage"
    
    if (!(Test-Path $dockerDir)) { New-Item -ItemType Directory -Path $dockerDir -Force | Out-Null }
    if (!(Test-Path $storageDir)) { New-Item -ItemType Directory -Path $storageDir -Force | Out-Null }
    
    # Save machine.id in docker and storage directories
    $dockerMachineId = Join-Path $dockerDir "machine.id"
    $storageMachineId = Join-Path $storageDir "machine.id"
    
    [System.IO.File]::WriteAllText($dockerMachineId, $fingerprint, [System.Text.Encoding]::UTF8)
    [System.IO.File]::WriteAllText($storageMachineId, $fingerprint, [System.Text.Encoding]::UTF8)
    
    # Update or append LMS_MACHINE_FINGERPRINT in docker/local.env
    $localEnv = Join-Path $dockerDir "local.env"
    if (Test-Path $localEnv) {
        $envContent = [System.IO.File]::ReadAllText($localEnv, [System.Text.Encoding]::UTF8)
        if ($envContent -match "LMS_MACHINE_FINGERPRINT=") {
            $updatedContent = [System.Text.RegularExpressions.Regex]::Replace($envContent, "LMS_MACHINE_FINGERPRINT=.*", "LMS_MACHINE_FINGERPRINT=$fingerprint")
            [System.IO.File]::WriteAllText($localEnv, $updatedContent, [System.Text.Encoding]::UTF8)
        } else {
            $appendLine = "`n# Deterministic Host Machine Fingerprint (Windows 10 / Windows 11)`nLMS_MACHINE_FINGERPRINT=$fingerprint`n"
            [System.IO.File]::AppendAllText($localEnv, $appendLine, [System.Text.Encoding]::UTF8)
        }
    }
}

if ($Quiet) {
    Write-Output $fingerprint
} else {
    Write-Host "`n========================================================" -ForegroundColor Cyan
    Write-Host "   LMS MEDICAL365 -- MACHINE FINGERPRINT IDENTIFIER" -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host " Host Operating System:   $([System.Environment]::OSVersion.VersionString)" -ForegroundColor White
    Write-Host " Machine Fingerprint ID:  $fingerprint" -ForegroundColor Green
    Write-Host " Status:                  Persisted to docker\machine.id & storage\machine.id" -ForegroundColor Gray
    Write-Host "========================================================`n" -ForegroundColor Cyan
    Write-Output $fingerprint
}
