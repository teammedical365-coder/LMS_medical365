/**
 * Lab Management System (LMS) - Dynamic Role-Scoped Sidebar Navigation
 * 
 * Supports:
 * 1. Platform Super Admin (Platform management only, clinical access separated).
 * 2. Laboratory Roles (Lab Admin, Receptionist, Accountant, Lab Tech, Pathologist/Reviewer, Phlebotomist).
 * 3. Dynamic role navigation items from user.roleDefinition.
 * 4. White-Label branding (custom logo, display name).
 */

import React from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  FlaskConical,
  TestTube2,
  FileText,
  CreditCard,
  ShieldCheck,
  Settings,
  History,
  X,
  Server,
  Building2,
  PlusCircle,
} from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';

export function Sidebar({ isOpen, onClose }) {
  const { tenant, branding } = useTenant();
  const { user, isSuperAdmin, tenant: authTenant } = useAuth();
  const location = useLocation();

  // Strict route-aware active item detector guaranteeing ONLY the current active tab is highlighted
  const isItemActive = (itemPath) => {
    const current = location.pathname.replace(/\/+$/, '') || '/';
    const target = itemPath.replace(/\/+$/, '') || '/';

    if (target === '/super-admin') {
      return current === '/super-admin';
    }
    if (target === '/super-admin/laboratories') {
      return current === '/super-admin/laboratories' || current.startsWith('/super-admin/laboratories/');
    }
    if (target === '/super-admin/roles') {
      return current === '/super-admin/roles';
    }
    if (target === '/dashboard') {
      return current === '/dashboard' || current === '/';
    }
    return current === target || (target !== '/' && current.startsWith(target + '/'));
  };

  // If Platform Super Admin, show ONLY Super Admin platform management
  if (isSuperAdmin) {
    const superAdminNavigation = [
      {
        section: 'Platform Super Admin',
        items: [
          { key: 'sa_overview', name: 'Platform Overview', path: '/super-admin', icon: Server, color: 'blue' },
          { key: 'sa_labs', name: 'Laboratories', path: '/super-admin/laboratories', icon: Building2, color: 'emerald' },
          { key: 'sa_roles', name: 'Roles & Permissions', path: '/super-admin/roles', icon: ShieldCheck, color: 'purple' },
        ],
      },
    ];

    return (
      <>
        <div
          className={`sidebar-overlay ${isOpen ? 'open' : ''}`}
          onClick={onClose}
          aria-hidden="true"
        />

        <aside className={`app-sidebar super-admin-sidebar ${isOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <Link to="/super-admin" className="brand-badge" onClick={onClose}>
              <div className="brand-icon-box" style={{ background: '#eff6ff', color: '#2563eb' }}>
                <Server size={20} />
              </div>
              <div className="brand-text-block">
                <span className="brand-title">LMS Platform</span>
              </div>
            </Link>

            <button
              onClick={onClose}
              className="btn-icon mobile-menu-btn"
              style={{ color: 'var(--slate-400)' }}
              aria-label="Close Navigation"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="sidebar-nav">
            {superAdminNavigation.map((group) => (
              <div key={group.section} style={{ marginBottom: '0.75rem' }}>
                <div className="nav-section-title">{group.section}</div>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={`nav-item ${active ? `active active-${item.color || 'blue'}` : ''}`}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon size={18} />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="tenant-indicator">
              <span className="tenant-dot" style={{ backgroundColor: '#2563eb' }} />
              <div className="tenant-details">
                <span className="tenant-name">Platform Super Admin</span>
              </div>
            </div>
          </div>
        </aside>
      </>
    );
  }

  // Determine authorized navigation keys dynamically from custom role and granted permissions
  const roleNavKeys = (() => {
    if (user?.roleDefinition?.navigationItems && Array.isArray(user.roleDefinition.navigationItems) && user.roleDefinition.navigationItems.length > 0) {
      return user.roleDefinition.navigationItems;
    }
    const perms = user?.permissions || user?.roleDefinition?.permissions || [];
    const r = (user?.role || '').toLowerCase();
    if (r === 'lab_admin' || r === 'lab_director' || perms.includes('*')) {
      return ['dashboard', 'patients', 'orders', 'samples', 'tests', 'reports', 'billing', 'users', 'audit', 'settings'];
    }
    // Derive navigation items directly from granted module permissions
    const derived = ['dashboard'];
    if (perms.some((p) => p.startsWith('patients:'))) derived.push('patients');
    if (perms.some((p) => p.startsWith('orders:'))) derived.push('orders');
    if (perms.some((p) => p.startsWith('samples:'))) derived.push('samples');
    if (perms.some((p) => p.startsWith('tests:'))) derived.push('tests');
    if (perms.some((p) => p.startsWith('reports:'))) derived.push('reports');
    if (perms.some((p) => p.startsWith('billing:'))) derived.push('billing');
    if (perms.some((p) => p.startsWith('users:') || p.startsWith('roles:'))) derived.push('users');
    if (perms.some((p) => p.startsWith('audit:'))) derived.push('audit');
    if (perms.some((p) => p.startsWith('settings:'))) derived.push('settings');
    return derived;
  })();

  const allSections = [
    {
      section: 'Laboratory Operations',
      items: [
        { key: 'dashboard', name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, color: 'blue' },
      ],
    },
    {
      section: 'Clinical Workflow',
      items: [
        { key: 'patients', name: 'Patients', path: '/patients', icon: Users, color: 'cyan' },
        { key: 'orders', name: 'Lab Orders', path: '/orders', icon: ClipboardList, color: 'indigo' },
        { key: 'samples', name: 'Samples', path: '/samples', icon: FlaskConical, color: 'emerald' },
        { key: 'tests', name: 'Test Catalog', path: '/tests', icon: TestTube2, color: 'amber' },
        { key: 'reports', name: 'Reports', path: '/reports', icon: FileText, color: 'rose' },
      ],
    },
    {
      section: 'Tenant Administration',
      items: [
        { key: 'billing', name: 'Billing & Ledger', path: '/billing', icon: CreditCard, color: 'emerald' },
        { key: 'users', name: 'Staff & Roles', path: '/users', icon: ShieldCheck, color: 'purple' },
        { key: 'audit', name: 'Audit Logs', path: '/audit-logs', icon: History, color: 'slate' },
        { key: 'settings', name: 'Lab Settings', path: '/settings', icon: Settings, color: 'indigo' },
      ],
    },
  ];

  // Filter sections and items based on role's allowed navigation items
  const authorizedSections = allSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => roleNavKeys.includes(item.key)),
    }))
    .filter((section) => section.items.length > 0);

  const displayBrandName = branding?.displayName || authTenant?.name || tenant?.name || 'LabMS';

  return (
    <>
      <div
        className={`sidebar-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Link to="/dashboard" className="brand-badge" onClick={onClose}>
            {branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt="Logo"
                style={{
                  height: '32px',
                  maxWidth: '36px',
                  objectFit: 'contain',
                  borderRadius: 'var(--radius-sm)',
                }}
              />
            ) : (
              <div className="brand-icon-box">
                <FlaskConical size={20} />
              </div>
            )}
            <div className="brand-text-block">
              <span className="brand-title" title={displayBrandName}>
                {displayBrandName.length > 18 ? `${displayBrandName.slice(0, 16)}...` : displayBrandName}
              </span>
              <span className="brand-subtitle">{authTenant?.code || tenant?.code || 'Diagnostics'}</span>
            </div>
          </Link>

          <button
            onClick={onClose}
            className="btn-icon mobile-menu-btn"
            style={{ color: 'var(--slate-400)' }}
            aria-label="Close Navigation"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {authorizedSections.map((group) => (
            <div key={group.section} style={{ marginBottom: '0.75rem' }}>
              <div className="nav-section-title">{group.section}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={`nav-item ${active ? `active active-${item.color || 'blue'}` : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon size={18} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="tenant-indicator">
            <span className="tenant-dot" />
            <div className="tenant-details">
              <span className="tenant-name" title={displayBrandName}>
                {displayBrandName}
              </span>
              <span className="tenant-type">
                {user?.role ? user.role.replace(/_/g, ' ').toUpperCase() : 'STAFF'}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
