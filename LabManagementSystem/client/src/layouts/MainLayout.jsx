/**
 * Lab Management System (LMS) - Main Application Layout Shell
 */

import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../components/common/Header';
import Sidebar from '../components/common/Sidebar';
import Breadcrumbs from '../components/common/Breadcrumbs';

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="app-main">
        <Header onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
        <Breadcrumbs />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
