/**
 * Lab Management System (LMS) - Top Navigation Header
 */

import React, { useState, useEffect, useRef } from 'react';
import { Search, Menu, LogOut, Building2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';

export function Header({ onToggleSidebar }) {
  const { user, isSuperAdmin, logout } = useAuth();
  const { tenant } = useTenant();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef(null);

  // Close profile dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials =
    user?.fullName
      ?.split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || (isSuperAdmin ? 'SA' : 'LU');

  const getDashboardDisplayName = () => {
    if (isSuperAdmin) return 'Super Admin';
    if (user?.roleDefinition?.name) return user.roleDefinition.name;
    const role = (user?.role || '').toLowerCase();
    const roleMap = {
      receptionist: 'Receptionist',
      reception: 'Receptionist',
      pathologist: 'Pathologist',
      lab_technician: 'Lab Technician',
      technician: 'Lab Technician',
      phlebotomist: 'Phlebotomist',
      lab_admin: 'Lab Administrator',
      admin: 'Lab Administrator',
      lab_director: 'Lab Director',
      billing: 'Billing & Accounts',
      accountant: 'Billing & Accounts',
      doctor: 'Doctor',
      physician: 'Physician',
    };
    if (roleMap[role]) return roleMap[role];
    if (user?.role) {
      return user.role
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }
    return 'Receptionist';
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <button
          onClick={onToggleSidebar}
          className="btn-icon mobile-menu-btn"
          aria-label="Toggle Navigation Menu"
        >
          <Menu size={20} />
        </button>

        {/* Portal & Role Title placed before search bar */}
        <div className="header-portal-title-block">
          <span className="header-portal-name">
            {getDashboardDisplayName()}
          </span>
          <span className="header-portal-pill">
            {isSuperAdmin ? 'Platform' : 'Portal'}
          </span>
        </div>
      </div>

      <div className="header-right">
        {/* Search Bar positioned on the right */}
        <div className="header-search">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search orders, patient MRN, sample barcode..."
            aria-label="Search"
          />
        </div>

        {/* Circular User Profile Avatar */}
        <div ref={profileRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="user-avatar-circle"
            onClick={() => setShowProfileMenu((prev) => !prev)}
            aria-label="User profile menu"
            title={user?.fullName || (isSuperAdmin ? 'Super Administrator' : 'Staff User')}
          >
            {initials}
          </button>

          {showProfileMenu && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 10px)',
                width: '240px',
                background: 'white',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-xl)',
                border: '1px solid var(--border-subtle)',
                zIndex: 60,
                overflow: 'hidden',
                animation: 'modalIn 0.18s ease-out',
              }}
            >
              <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--slate-100)', background: 'var(--slate-50)' }}>
                <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--slate-900)', margin: '0 0 3px 0' }}>
                  {isSuperAdmin ? 'Super Administrator' : (user?.fullName || 'Staff User')}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)', margin: 0 }}>
                  {user?.email || 'superadmin@test.com'}
                </p>
              </div>

              <div style={{ padding: '0.5rem' }}>
                <button
                  type="button"
                  onClick={logout}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--danger-600)',
                    cursor: 'pointer',
                    background: 'transparent',
                    border: 'none',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--danger-50)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <LogOut size={15} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
