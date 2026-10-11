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

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TenantProvider>
          <AppRoutes />
        </TenantProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
