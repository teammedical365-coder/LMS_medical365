/**
 * Lab Management System (LMS) - Public Diagnostic Report Authenticity Verification Page
 * 
 * Accessible without login by scanning report QR code or following public verification link.
 * STRICT PRIVACY: Displays ONLY verified authenticity metadata (lab name, report #, release date).
 * Never exposes patient demographics, MRN, or diagnostic parameter findings.
 */

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, Clock, Building2, FileCheck, CheckCircle2 } from 'lucide-react';
import clinicalService from '../../services/clinicalService';

export default function PublicVerifyReportPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [verification, setVerification] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function verify() {
      if (!token) {
        setError('Missing verification token');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const res = await clinicalService.verifyPublicReport(token);
        if (isMounted) {
          if (res.success && res.data?.valid) {
            setVerification(res.data);
          } else {
            setError(res.message || 'Report verification record not found');
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err.response?.data?.message ||
              'This verification token does not match any officially released laboratory report on this system.'
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    verify();
    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        padding: '1.5rem',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            background: verification ? 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)' : '#1e293b',
            padding: '24px',
            color: '#ffffff',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px auto',
            }}
          >
            {loading ? (
              <Clock size={32} color="#ffffff" />
            ) : verification ? (
              <ShieldCheck size={36} color="#ffffff" />
            ) : (
              <ShieldAlert size={36} color="#fda4af" />
            )}
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            Official Report Verification
          </h1>
          <p style={{ fontSize: '0.8125rem', opacity: 0.9, marginTop: '4px', marginBottom: 0 }}>
            Medical365 Diagnostic Platform Authenticity Registry
          </p>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748b' }}>
              <p style={{ fontWeight: 500 }}>Validating digital verification token...</p>
              <p style={{ fontSize: '0.8125rem' }}>Verifying with laboratory master registry</p>
            </div>
          ) : verification ? (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  marginBottom: '20px',
                  color: '#166534',
                }}
              >
                <CheckCircle2 size={22} style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                    Authentic Diagnostic Report
                  </div>
                  <div style={{ fontSize: '0.8125rem' }}>
                    This document was officially approved, verified, and released by an authorized pathology director.
                  </div>
                </div>
              </div>

              {/* Minimal Public Verification Metadata */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  background: '#f8fafc',
                  padding: '18px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8125rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Building2 size={16} /> Laboratory
                  </span>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0f172a' }}>
                    {verification.labName}
                  </span>
                </div>

                <div style={{ height: '1px', background: '#e2e8f0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8125rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileCheck size={16} /> Official Report #
                  </span>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '0.9375rem',
                      fontFamily: 'monospace',
                      color: '#0369a1',
                    }}
                  >
                    {verification.reportNumber}
                  </span>
                </div>

                <div style={{ height: '1px', background: '#e2e8f0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>Release Status</span>
                  <span
                    style={{
                      background: '#dcfce7',
                      color: '#15803d',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: '999px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {verification.status}
                  </span>
                </div>

                <div style={{ height: '1px', background: '#e2e8f0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8125rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={16} /> Official Release Date
                  </span>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                    {verification.releasedAt
                      ? new Date(verification.releasedAt).toLocaleString()
                      : 'Verified'}
                  </span>
                </div>
              </div>

              {/* Privacy Notice Banner */}
              <div
                style={{
                  marginTop: '20px',
                  padding: '12px 14px',
                  background: '#f1f5f9',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  color: '#475569',
                  lineHeight: '1.4',
                }}
              >
                <strong>Diagnostic Privacy Notice:</strong> Patient demographic details and clinical analyte results are protected health information and are strictly excluded from this public validation screen.
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  padding: '16px',
                  color: '#991b1b',
                  marginBottom: '20px',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '6px' }}>
                  Verification Record Not Found
                </div>
                <div style={{ fontSize: '0.8125rem', lineHeight: '1.4' }}>
                  {error || 'This token could not be verified against the official laboratory database.'}
                </div>
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                If you believe this is an error, please present the printed physical report to the issuing laboratory or physician.
              </p>
            </div>
          )}

          {/* Footer Back */}
          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <Link
              to="/login"
              style={{
                fontSize: '0.8125rem',
                color: '#2563eb',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              &larr; Return to Laboratory Portal Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
