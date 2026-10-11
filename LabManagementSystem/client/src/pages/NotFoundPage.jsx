/**
 * Lab Management System (LMS) - 404 Not Found Page
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Home } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: '2rem' }}>
      <div style={{ color: 'var(--primary-600)', marginBottom: '1rem' }}>
        <AlertCircle size={64} />
      </div>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>404 - Page Not Found</h1>
      <p style={{ color: 'var(--slate-500)', maxWidth: '420px', marginBottom: '1.5rem' }}>
        The laboratory module or requisition link you are attempting to access does not exist or has moved.
      </p>
      <Link to="/dashboard" className="btn btn-primary">
        <Home size={16} />
        <span>Return to Dashboard</span>
      </Link>
    </div>
  );
}

export default NotFoundPage;
