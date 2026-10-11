/**
 * Lab Management System (LMS) - Authentication Layout Shell
 */

import React from 'react';
import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="auth-page-container">
      <Outlet />
    </div>
  );
}

export default AuthLayout;
