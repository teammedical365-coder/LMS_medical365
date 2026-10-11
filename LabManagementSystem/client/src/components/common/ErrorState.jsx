/**
 * Lab Management System (LMS) - Error State Component
 */

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export function ErrorState({
  title = 'Unable to load module data',
  message = 'An unexpected error occurred while communicating with the laboratory service.',
  onRetry,
}) {
  return (
    <div className="state-container" style={{ borderColor: 'var(--danger-100)', backgroundColor: 'var(--danger-50)' }}>
      <div style={{ color: 'var(--danger-600)', marginBottom: '0.75rem' }}>
        <AlertTriangle size={44} />
      </div>
      <h3 className="state-title" style={{ color: 'var(--danger-700)' }}>{title}</h3>
      <p className="state-desc" style={{ color: 'var(--slate-600)' }}>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-secondary btn-sm" style={{ gap: '6px' }}>
          <RefreshCw size={14} />
          <span>Retry Operation</span>
        </button>
      )}
    </div>
  );
}

export default ErrorState;
