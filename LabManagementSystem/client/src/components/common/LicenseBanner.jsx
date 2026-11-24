/**
 * Lab Management System (LMS) - License Status Banner & Activation Modal
 * Healthcare Clinical Safety Rule: Notifies users when operating in Read-Only Mode
 * and provides one-click Machine Fingerprint copy and License Key activation.
 */

import React, { useState, useEffect } from 'react';
import { ShieldAlert, ShieldCheck, Key, Copy, Check, AlertTriangle, X, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import notify from '../../utils/notify';

export function LicenseBanner() {
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [activating, setActivating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchLicenseStatus = async () => {
    try {
      const res = await api.get('/system/license');
      if (res.data?.success && res.data?.data) {
        setLicenseInfo(res.data.data);
      }
    } catch (_) {
      // In cloud mode or if endpoint unreachable, do not disrupt UI
    }
  };

  useEffect(() => {
    fetchLicenseStatus();
    // Periodically re-check every 5 minutes
    const interval = setInterval(fetchLicenseStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyFingerprint = () => {
    if (!licenseInfo?.machineFingerprint) return;
    navigator.clipboard.writeText(licenseInfo.machineFingerprint);
    setCopied(true);
    notify.success('Machine Fingerprint copied to clipboard.');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) {
      setErrorMsg('Please enter or paste your license key.');
      return;
    }

    setActivating(true);
    setErrorMsg('');
    try {
      const res = await api.post('/system/license/activate', {
        licenseKey: licenseKeyInput.trim(),
      });
      if (res.data?.success) {
        notify.success('License activated successfully! Full write access restored.');
        setShowModal(false);
        setLicenseKeyInput('');
        fetchLicenseStatus();
      } else {
        setErrorMsg(res.data?.message || 'License activation failed.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error?.message || 'Activation failed. Please check the license key.';
      setErrorMsg(msg);
      notify.error(msg);
    } finally {
      setActivating(false);
    }
  };

  if (!licenseInfo) return null;

  // If active and not in grace period, no alert banner needed
  if (licenseInfo.isValid && licenseInfo.status === 'ACTIVE' && !licenseInfo.isReadOnly) {
    return null;
  }

  const isGrace = licenseInfo.status === 'GRACE_PERIOD';
  const bannerBg = isGrace ? '#fef3c7' : '#fee2e2';
  const bannerBorder = isGrace ? '#f59e0b' : '#ef4444';
  const bannerColor = isGrace ? '#92400e' : '#991b1b';

  return (
    <>
      <div
        style={{
          background: bannerBg,
          borderLeft: `5px solid ${bannerBorder}`,
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.875rem',
          color: bannerColor,
          marginBottom: '1rem',
          borderRadius: '6px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isGrace ? <AlertTriangle size={18} /> : <ShieldAlert size={18} />}
          <div>
            <strong>
              {isGrace
                ? `License Operating in Grace Period (${licenseInfo.daysRemaining} days remaining)`
                : `Medical365 Local Edition: ${licenseInfo.status} (Read-Only Mode)`}
            </strong>
            <span style={{ marginLeft: '8px' }}>
              {isGrace
                ? 'Please renew or activate your license before the grace period ends.'
                : 'Patient and diagnostic records remain fully accessible for view and printing. Write operations require activation.'}
            </span>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          style={{
            background: bannerBorder,
            color: '#ffffff',
            border: 'none',
            padding: '6px 14px',
            borderRadius: '4px',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.8125rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Key size={14} />
          Activate License
        </button>
      </div>

      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              maxWidth: '560px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Key size={22} style={{ color: '#2563eb' }} />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#1e293b' }}>
                  Medical365 License Activation
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                Host Machine Fingerprint
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  readOnly
                  value={licenseInfo.machineFingerprint || 'Detecting...'}
                  style={{
                    flex: 1,
                    fontFamily: 'monospace',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontSize: '0.875rem',
                  }}
                />
                <button
                  type="button"
                  onClick={handleCopyFingerprint}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 500,
                    fontSize: '0.8125rem',
                  }}
                >
                  {copied ? <Check size={16} style={{ color: '#10b981' }} /> : <Copy size={16} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                Provide this Machine Fingerprint to Medical365 Support to obtain your RSA-signed license key.
              </p>
            </div>

            <form onSubmit={handleActivate}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  License Key (JSON or Base64)
                </label>
                <textarea
                  rows={5}
                  value={licenseKeyInput}
                  onChange={(e) => setLicenseKeyInput(e.target.value)}
                  placeholder='Paste the signed license key provided by Medical365...'
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontFamily: 'monospace',
                    fontSize: '0.8125rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {errorMsg && (
                <div
                  style={{
                    padding: '8px 12px',
                    background: '#fee2e2',
                    borderLeft: '4px solid #ef4444',
                    color: '#991b1b',
                    fontSize: '0.8125rem',
                    borderRadius: '4px',
                    marginBottom: '16px',
                  }}
                >
                  {errorMsg}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '8px 16px',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    color: '#475569',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={activating}
                  style={{
                    padding: '8px 18px',
                    background: '#2563eb',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: activating ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    color: '#ffffff',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {activating && <RefreshCw size={16} className="spin" />}
                  {activating ? 'Activating...' : 'Activate License'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default LicenseBanner;
