/**
 * Lab Management System (LMS) - Reusable Confirmation Modal
 * 
 * Features:
 * - Fixed centered layout with translucent backdrop and subtle background blur.
 * - Body scroll lock on open (restores original overflow on close/unmount).
 * - Background click blocking (never executes action on backdrop clicks).
 * - Duplicate submission prevention with internal & external loading states.
 * - Responsive layout adapted for mobile and desktop viewports.
 * - Accessible keyboard handling (Escape to cancel unless processing).
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, AlertCircle, Info, HelpCircle, X, Loader2 } from 'lucide-react';

const VARIANT_CONFIGS = {
  danger: {
    icon: AlertTriangle,
    iconColor: '#dc2626',
    iconBg: '#fee2e2',
    confirmBtnClass: 'btn-danger',
    confirmBtnStyle: { background: '#dc2626', borderColor: '#b91c1c', color: '#ffffff' },
  },
  warning: {
    icon: AlertCircle,
    iconColor: '#d97706',
    iconBg: '#fef3c7',
    confirmBtnClass: 'btn-warning',
    confirmBtnStyle: { background: '#d97706', borderColor: '#b45309', color: '#ffffff' },
  },
  primary: {
    icon: Info,
    iconColor: '#2563eb',
    iconBg: '#dbeafe',
    confirmBtnClass: 'btn-primary',
    confirmBtnStyle: { background: '#2563eb', borderColor: '#1d4ed8', color: '#ffffff' },
  },
  info: {
    icon: HelpCircle,
    iconColor: '#0284c7',
    iconBg: '#e0f2fe',
    confirmBtnClass: 'btn-info',
    confirmBtnStyle: { background: '#0284c7', borderColor: '#0369a1', color: '#ffffff' },
  },
};

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Please Confirm',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading: externalLoading = false,
  preventBackdropClose = false,
}) {
  const [internalLoading, setInternalLoading] = useState(false);
  const loading = externalLoading || internalLoading;

  // Body scroll lock effect
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Keyboard shortcut (Escape to cancel unless processing)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose?.();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const config = VARIANT_CONFIGS[variant] || VARIANT_CONFIGS.danger;
  const IconComponent = config.icon;

  const handleConfirmClick = async () => {
    if (loading) return; // Prevent duplicate execution
    try {
      setInternalLoading(true);
      const result = onConfirm?.();
      // If onConfirm returns a promise, wait for resolution
      if (result && typeof result.then === 'function') {
        await result;
      }
      onClose?.();
    } catch (err) {
      // Allow parent error handlers to display toast
      console.error('ConfirmModal action error:', err);
    } finally {
      setInternalLoading(false);
    }
  };

  const handleBackdropClick = (e) => {
    // Never perform action on backdrop click.
    // If not processing and backdrop close is allowed, dismiss.
    if (e.target === e.currentTarget && !loading && !preventBackdropClose) {
      onClose?.();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        padding: '1rem',
        overflowY: 'auto',
      }}
      onClick={handleBackdropClick}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          background: '#ffffff',
          borderRadius: '14px',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(226, 232, 240, 0.8)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          animation: 'confirmModalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          margin: 'auto',
        }}
        onClick={(e) => e.stopPropagation()} // Prevent click propagation to backdrop
      >
        {/* Modal Top Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px',
            padding: '1.5rem 1.5rem 1rem 1.5rem',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: config.iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconComponent size={22} color={config.iconColor} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              id="confirm-modal-title"
              style={{
                margin: '0 0 0.35rem 0',
                fontSize: '1.1rem',
                fontWeight: 700,
                color: '#0f172a',
                lineHeight: 1.3,
              }}
            >
              {title}
            </h3>

            <div
              style={{
                margin: 0,
                fontSize: '0.875rem',
                color: '#475569',
                lineHeight: 1.5,
              }}
            >
              {typeof message === 'string' ? <p style={{ margin: 0 }}>{message}</p> : message}
            </div>
          </div>

          {!loading && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: '4px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.15s ease',
              }}
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            padding: '1rem 1.5rem',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '0.5rem 1rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {cancelText}
          </button>

          <button
            type="button"
            className={`btn ${config.confirmBtnClass} btn-sm`}
            onClick={handleConfirmClick}
            disabled={loading}
            style={{
              ...config.confirmBtnStyle,
              padding: '0.5rem 1.15rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.75 : 1,
            }}
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            <span>{loading ? 'Processing...' : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
