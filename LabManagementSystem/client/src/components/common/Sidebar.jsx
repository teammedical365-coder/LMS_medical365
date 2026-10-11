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
import { NavLink, Link } from 'react-router-dom';
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

  // If Platform Super Admin, show ONLY Super Admin platform management
  if (isSuperAdmin) {
    const superAdminNavigation = [
      {
        section: 'Platform Super Admin',
        items: [
          { key: 'sa_overview', name: 'Platform Overview', path: '/super-admin', icon: Server },
          { key: 'sa_labs', name: 'Laboratories', path: '/super-admin/laboratories', icon: Building2 },
          { key: 'sa_register', name: 'Register Laboratory', path: '/super-admin/laboratories/new', icon: PlusCircle },
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

        <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <Link to="/super-admin" className="brand-badge" onClick={onClose}>
              <div className="brand-icon-box" style={{ background: '#eff6ff', color: '#2563eb' }}>
                <Server size={20} />
              </div>
              <div className="brand-text-block">
                <span className="brand-title">LMS Platform</span>
                <span className="brand-subtitle">Master Registry</span>
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
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `nav-item ${isActive ? 'active' : ''}`
                      }
                    >
                      <Icon size={18} />
                      <span>{item.name}</span>
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="tenant-indicator">
              <span className="tenant-dot" style={{ backgroundColor: '#2563eb' }} />
              <div className="tenant-details">
                <span className="tenant-name">Master Registry</span>
                <span className="tenant-type">Platform Super Admin</span>
              </div>
            </div>
          </div>
        </aside>
      </>
    );
  }

  // Determine authorized navigation keys for tenant user
  const roleNavKeys = user?.roleDefinition?.navigationItems || (() => {
    const r = (user?.role || '').toLowerCase();
    if (r === 'lab_admin' || r === 'lab_director') {
      return ['dashboard', 'patients', 'orders', 'samples', 'tests', 'reports', 'billing', 'users', 'audit', 'settings'];
    }
    if (r === 'receptionist') {
      return ['dashboard', 'patients', 'orders'];
    }
    if (r === 'billing_clerk' || r === 'accountant') {
      return ['dashboard', 'orders', 'billing'];
    }
    if (r === 'lab_technician') {
      return ['dashboard', 'patients', 'orders', 'samples', 'tests', 'reports'];
    }
    if (r === 'pathologist' || r === 'report_reviewer') {
      return ['dashboard', 'patients', 'orders', 'samples', 'reports'];
    }
    if (r === 'phlebotomist') {
      return ['dashboard', 'patients', 'orders', 'samples'];
    }
    return ['dashboard'];
  })();

  const allSections = [
    {
      section: 'Laboratory Operations',
      items: [
        { key: 'dashboard', name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      section: 'Clinical Workflow',
      items: [
        { key: 'patients', name: 'Patients', path: '/patients', icon: Users },
        { key: 'orders', name: 'Lab Orders', path: '/orders', icon: ClipboardList },
        { key: 'samples', name: 'Samples', path: '/samples', icon: FlaskConical },
        { key: 'tests', name: 'Test Catalog', path: '/tests', icon: TestTube2 },
        { key: 'reports', name: 'Reports', path: '/reports', icon: FileText },
      ],
    },
    {
      section: 'Tenant Administration',
      items: [
        { key: 'billing', name: 'Billing & Ledger', path: '/billing', icon: CreditCard },
        { key: 'users', name: 'Staff & Roles', path: '/users', icon: ShieldCheck },
        { key: 'audit', name: 'Audit Logs', path: '/audit-logs', icon: History },
        { key: 'settings', name: 'Lab Settings', path: '/settings', icon: Settings },
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
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `nav-item ${isActive ? 'active' : ''}`
                    }
                  >
                    <Icon size={18} />
                    <span>{item.name}</span>
                  </NavLink>
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
