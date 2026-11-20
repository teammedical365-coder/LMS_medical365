# FINAL OFFLINE INSTALLER INTEGRATION AUDIT

**Project:** LMS Medical365 (Local / On-Premise Edition)  
**Evaluation Role:** Senior Windows Installer & DevOps QA Engineer  
**Target Platform:** Windows 10/11 64-bit Air-Gapped Workstations  
**Audit Date:** November 20, 2026  
**Final Verdict:** **CONDITIONAL GO — READY FOR PHYSICAL CLIENT-PC ACCEPTANCE TESTING**  
*(Packaging, dynamic archive resolution, checksum verification, and loading sequence verified; physical execution on a clean client PC remains the final prerequisite for full production sign-off)*

---

## 1. EXECUTIVE SUMMARY

An end-to-end integration audit of the offline Docker image distribution and installation mechanism was conducted.

The audit verified that the distribution model is a **Folder-Based Distribution Package** (`installer_dist/`), consisting of:
1. `LMS_Medical365_Local_Edition_Setup_v1.0.0.exe` (2.16 MB)
2. `LMS_Medical365_Offline_Images_v1.0.0.tar` (369.39 MB)
3. `offline-images.sha256` (109 B)
4. `offline-images-manifest.json` (2.14 KB)

The Inno Setup script ([installer/build-installer.iss](file:///d:/Laboratry_medical365/LabManagementSystem/installer/build-installer.iss)) was enhanced with dynamic path resolution (`GetOfflineImageArchivePath`) and pre-execution safeguards (`ShouldLoadOfflineImages`). The installer was recompiled and verified via SHA-256 hash calculation.

The primary running local LMS database (**60 documents**) and active Docker containers remained **100% untouched and operational** throughout the audit.

---

## 2. AUDIT EVALUATION MATRIX (10 VERIFICATION AREAS)

| # | Verification Area | Status | Audit Findings & Technical Evidence |
|---|---|:---:|---|
| **1** | **Archive Location & Detection** | **PASS** | `build-installer.iss` uses `GetOfflineImageArchivePath` and `HasOfflineImageArchive` in Pascal code, searching `{src}\`, `{src}\installer_dist\`, and `{app}\installer_dist\`. Detects USB root or subfolder transparently. |
| **2** | **Distribution Model (Embedded vs Side-by-Side)** | **PASS** | **Confirmed:** Archive is **NOT embedded** inside the setup executable. It is distributed side-by-side in `installer_dist/`. This prevents exceeding Inno Setup binary limits, speeds up unpack, and allows standalone hash validation. |
| **3** | **Archive Access Mechanism** | **PASS** | The installer accesses the TAR directly from `{src}` (the USB media or source folder) during `load-offline-images.ps1`. It does not waste 370 MB of disk space copying the archive into `{app}`. |
| **4** | **Parameter Passing to `load-offline-images.ps1`** | **PASS** | The `[Run]` section calls `load-offline-images.ps1 -ArchivePath "{code:GetOfflineImageArchivePath}"`. The script automatically discovers `offline-images.sha256` in the archive directory. |
| **5** | **Pre-Load SHA-256 Cryptographic Validation** | **PASS** | In `load-offline-images.ps1` Section 3, `(Get-FileHash ... SHA256)` is calculated before calling `docker load`. If hash mismatches, it outputs `CHECKSUM VERIFICATION FAILED` and exits with code 1. Verified by Test 6 in `test_offline_image_packaging.js`. |
| **6** | **Pre-Service Image Verification** | **PASS** | In `build-installer.iss`, `load-offline-images.ps1` runs in `[Run]` before `manage-lms.bat`. In `load-offline-images.ps1`, Section 6 queries `docker image inspect` on all 3 tags (`mongo:7.0`, `backend`, `frontend`) and aborts if any tag is missing. |
| **7** | **Failure Handling (Missing Archive / Docker Offline)** | **PASS** | `InitializeSetup` warns the user if Docker Desktop or the TAR archive is missing. In `[Run]`, `Check: ShouldLoadOfflineImages` prevents executing image loading if Docker is offline or the archive is absent, avoiding installer crashes. |
| **8** | **Offline USB Installation Capability** | **PASS** | Validated architecture: Double-clicking `Setup.exe` directly from a USB drive mounts `{src}` as the USB path, streams images into local Docker Desktop via `docker load`, and creates desktop shortcuts without internet access. |
| **9** | **Accuracy of Client Documentation** | **PASS** | Detailed instructions in Section 5 list all 4 required files, prerequisites, and step-by-step procedures for laboratory technicians. |
| **10** | **Sterile Package Guarantee (Zero Data Leakage)** | **PASS** | Test 8 in `test_offline_image_packaging.js` verified via `tar -tf` that the archive contains zero `.bson` database files, zero patient records, zero `local.env` secrets, zero license private keys, and zero backups. |

---

## 3. EXACT ARTIFACT PATHS, SIZES & CRYPTOGRAPHIC HASHES

All production distribution deliverables reside in [installer_dist/](file:///d:/Laboratry_medical365/LabManagementSystem/installer_dist):

| File Name | Location | Size | SHA-256 Hash |
|---|---|:---:|---|
| `LMS_Medical365_Local_Edition_Setup_v1.0.0.exe` | `installer_dist\` | 2,265,997 B (2.16 MB) | `1C545843562D6C7DEA68F0DD17C24B299FB72BCB87A672ADA43F68B714305397` |
| `LMS_Medical365_Offline_Images_v1.0.0.tar` | `installer_dist\` | 387,337,728 B (369.39 MB) | `577434B95210402C699AA66BA9545ED022ED0979E630F56EA9F1EA9D5F1D8C13` |
| `offline-images.sha256` | `installer_dist\` | 109 B | Checksum manifest file |
| `offline-images-manifest.json` | `installer_dist\` | 2,143 B | Image metadata & version catalog |

**Total Distribution Package Size:** **389,606,000 bytes (~371.55 MB / ~0.37 GB)**.

---

## 4. INNO SETUP INTEGRATION AUDIT

### 4.1 Pascal Helper Functions
Implemented in [installer/build-installer.iss](file:///d:/Laboratry_medical365/LabManagementSystem/installer/build-installer.iss):

```pascal
function HasOfflineImageArchive(): Boolean;
begin
  Result := FileExists(ExpandConstant('{src}\LMS_Medical365_Offline_Images_v1.0.0.tar')) or
            FileExists(ExpandConstant('{src}\installer_dist\LMS_Medical365_Offline_Images_v1.0.0.tar')) or
            FileExists(ExpandConstant('{app}\installer_dist\LMS_Medical365_Offline_Images_v1.0.0.tar'));
end;

function GetOfflineImageArchivePath(Param: String): String;
begin
  if FileExists(ExpandConstant('{src}\LMS_Medical365_Offline_Images_v1.0.0.tar')) then
    Result := ExpandConstant('{src}\LMS_Medical365_Offline_Images_v1.0.0.tar')
  else if FileExists(ExpandConstant('{src}\installer_dist\LMS_Medical365_Offline_Images_v1.0.0.tar')) then
    Result := ExpandConstant('{src}\installer_dist\LMS_Medical365_Offline_Images_v1.0.0.tar')
  else if FileExists(ExpandConstant('{app}\installer_dist\LMS_Medical365_Offline_Images_v1.0.0.tar')) then
    Result := ExpandConstant('{app}\installer_dist\LMS_Medical365_Offline_Images_v1.0.0.tar')
  else
    Result := ExpandConstant('{src}\LMS_Medical365_Offline_Images_v1.0.0.tar');
end;

function ShouldLoadOfflineImages(): Boolean;
begin
  Result := IsDockerInstalled() and HasOfflineImageArchive();
end;
```

### 4.2 Sequence of Operations in `[Run]`
1. **Network Firewall Configuration:** `netsh.exe` opens inbound TCP Port 80 for LAN access.
2. **Offline Image Loading:** `load-offline-images.ps1` runs with `-ArchivePath "{code:GetOfflineImageArchivePath}"`. Validates SHA-256 hash, runs `docker load -i`, and confirms `mongo:7.0`, `lms-medical365-backend:local`, and `lms-medical365-frontend:local` exist in the Docker engine.
3. **Operations Console Launcher:** `manage-lms.bat` offers the operator an interactive menu to start services, run backups, or check status.

---

## 5. FINAL CLIENT INSTALLATION INSTRUCTIONS (AIR-GAPPED PC)

### Preparation
1. Ensure the destination PC runs **Windows 10 Pro/Enterprise (Build 19041+)** or **Windows 11 (64-bit)** with at least 8 GB RAM and 20 GB free disk space.
2. Install **Docker Desktop for Windows** with WSL2 backend enabled. Launch Docker Desktop and verify the status shows "Docker Desktop is running".
3. Copy the entire `installer_dist` folder to a USB flash drive (requires at least 1 GB free on USB).

### Installation Procedure
1. Plug the USB flash drive into the air-gapped PC.
2. Open the `installer_dist` folder on the USB drive. Ensure all four files are present:
   - `LMS_Medical365_Local_Edition_Setup_v1.0.0.exe`
   - `LMS_Medical365_Offline_Images_v1.0.0.tar`
   - `offline-images.sha256`
   - `offline-images-manifest.json`
3. Right-click `LMS_Medical365_Local_Edition_Setup_v1.0.0.exe` and select **"Run as administrator"**.
4. Follow the setup wizard prompts. Ensure the task **"Load Offline Docker Images into Docker engine"** is checked.
5. Setup will automatically verify the SHA-256 checksum and load the images directly from the USB drive into Docker.
6. When installation finishes, leave "Launch LMS Medical365 Management Console" checked and click **Finish**.

### First-Time Service Startup
1. In the Management Console, select option `[2] Start LMS Services`.
2. The containers will initialize immediately using the pre-loaded offline images. No internet connection is required.
3. Access the web portal locally at `http://localhost` or over the LAN at `http://<SERVER_LAN_IP>`.

---

## 6. REGRESSION VERIFICATION & LIVE DATABASE INTEGRITY

All three automated test suites were executed on the active system:

- **Offline Packaging Test Suite:** **8 / 8 Passed** ([server/scripts/test_offline_image_packaging.js](file:///d:/Laboratry_medical365/LabManagementSystem/server/scripts/test_offline_image_packaging.js))
- **Phase 5 Deployment & Licensing Suite:** **25 / 25 Passed** ([server/scripts/test_phase5_deployment.js](file:///d:/Laboratry_medical365/LabManagementSystem/server/scripts/test_phase5_deployment.js))
- **Restore Safety Audit Suite:** **14 / 14 Passed** ([server/scripts/test_restore_safety_audit.js](file:///d:/Laboratry_medical365/LabManagementSystem/server/scripts/test_restore_safety_audit.js))
- **Live Database Records:** Exactly **60 documents** verified intact in `lms_local_mongo` (`masterCount: 31`, `tenantCount: 29`).
- **Git Working Tree:** Preserved; zero commits or pushes made.

---

## 7. REMAINING REAL-WORLD VALIDATION REQUIREMENTS

To transition from **CONDITIONAL GO** to **FULL PRODUCTION RELEASE**, the deployment team must perform the final physical acceptance test:
1. **Physical Hardware Acceptance:** Execute the steps in Section 5 on an actual separate physical Windows 10/11 workstation without internet connectivity.
2. **Host Reboot Test:** Reboot the central workstation and verify containers recover automatically (`restart: unless-stopped`) with all patient records intact.
