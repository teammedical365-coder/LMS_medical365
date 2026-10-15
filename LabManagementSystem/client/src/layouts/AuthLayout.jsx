/**
 * Lab Management System (LMS) - Authentication Layout Shell
 */

import React from 'react';
import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="auth-shell">
      <Outlet />
    </div>
  );
}

export default AuthLayout;
