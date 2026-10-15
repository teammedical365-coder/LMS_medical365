/**
 * Lab Management System (LMS) - Root Application Component
 */

import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { TenantProvider } from './context/TenantContext';
import AppRoutes from './routes/AppRoutes';

// Global Styles
import './styles/variables.css';
import './styles/global.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/auth-page.css';

import { Toaster } from 'react-hot-toast';

export function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <TenantProvider>
          <AppRoutes />
          <Toaster
            position="top-center"
            reverseOrder={false}
            gutter={8}
            containerStyle={{ zIndex: 999999 }}
            toastOptions={{
              duration: 3500,
              style: {
                background: '#ffffff',
                color: '#1e293b',
                boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.15), 0 8px 10px -6px rgba(15, 23, 42, 0.08)',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                padding: '12px 16px',
                fontSize: '0.875rem',
                fontWeight: 500,
                maxWidth: '420px',
              },
              success: {
                duration: 3500,
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#ffffff',
                },
                style: {
                  borderLeft: '4px solid #10b981',
                },
              },
              error: {
                duration: 4500,
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#ffffff',
                },
                style: {
                  borderLeft: '4px solid #ef4444',
                },
              },
            }}
          />
        </TenantProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
