/**
 * Lab Management System (LMS) - Top Navigation Header
 */

import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, Menu, CheckCircle2, AlertCircle, LogOut, User, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import healthService from '../../services/healthService';

export function Header({ onToggleSidebar }) {
  const { user, isSuperAdmin, logout } = useAuth();
  const { tenant } = useTenant();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [serverHealth, setServerHealth] = useState({ isOnline: false, checking: true });
  const profileRef = useRef(null);
  const notifRef = useRef(null);

  // Check backend server connectivity on mount
  useEffect(() => {
    let isMounted = true;
    healthService.getHealth().then((res) => {
      if (isMounted) {
        setServerHealth({ isOnline: res.isOnline, checking: false });
      }
    });
    return () => { isMounted = false; };
  }, []);

  // Close popups on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sampleNotifications = [
    { id: 1, title: 'Critical Alert', text: 'Potassium critical value: Patient MRN-4091', time: '10m ago', urgent: true },
    { id: 2, title: 'Batch Verified', text: 'Hematology Run #B-1042 verified by Pathologist', time: '35m ago', urgent: false },
    { id: 3, title: 'System Notice', text: 'Phase 1 Project Foundation mode active', time: '1h ago', urgent: false },
  ];

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

        <div className="header-search">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search orders, patient MRN, sample barcode..."
            aria-label="Search"
          />
        </div>
      </div>

      <div className="header-right">
        {/* Backend API Health Status Indicator */}
        <div
          title={serverHealth.isOnline ? 'Express Backend API connected' : 'Backend API not reachable'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.75rem',
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: '9999px',
            background: serverHealth.isOnline ? 'var(--mint-bg)' : 'var(--warning-50)',
            color: serverHealth.isOnline ? 'var(--mint-text)' : 'var(--warning-700)',
            border: `1px solid ${serverHealth.isOnline ? 'var(--mint-200)' : '#fde68a'}`,
            boxShadow: '0 1px 2px rgba(16, 185, 129, 0.06)',
          }}
        >
          {serverHealth.isOnline ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
          <span>{serverHealth.isOnline ? 'API Online' : 'API Offline (Mock)'}</span>
        </div>

        {/* Notifications Dropdown */}
        <div className="icon-badge-wrap" ref={notifRef} style={{ position: 'relative' }}>
          <button
            className="btn-icon"
            onClick={() => setShowNotifications((prev) => !prev)}
            aria-label="View notifications"
          >
            <Bell size={19} />
            <span className="badge-count">3</span>
          </button>

          {showNotifications && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 8px)',
                width: '320px',
                background: 'white',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-xl)',
                border: '1px solid var(--border-subtle)',
                zIndex: 50,
                padding: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0.5rem 0.5rem', borderBottom: '1px solid var(--slate-100)' }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Notifications</span>
                <span style={{ fontSize: '0.6875rem', color: 'var(--primary-blue)', cursor: 'pointer' }}>Mark all read</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                {sampleNotifications.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      padding: '0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      background: n.urgent ? 'var(--danger-50)' : 'var(--slate-50)',
                      borderLeft: n.urgent ? '3px solid var(--danger-500)' : '3px solid var(--slate-300)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: n.urgent ? 'var(--danger-700)' : 'var(--slate-800)' }}>
                        {n.title}
                      </span>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--slate-400)' }}>{n.time}</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--slate-600)', marginTop: '2px' }}>{n.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div ref={profileRef} style={{ position: 'relative' }}>
          <div
            className="user-menu-trigger"
            onClick={() => setShowProfileMenu((prev) => !prev)}
            role="button"
            tabIndex={0}
          >
            <div className="user-avatar">
              {user?.fullName?.split(' ').map((n) => n[0]).slice(0, 2).join('') || (isSuperAdmin ? 'SA' : 'LU')}
            </div>
            <div className="user-info-text">
              <span className="user-name">{user?.fullName || (isSuperAdmin ? 'Super Administrator' : 'Lab User')}</span>
              <span className="user-role">{isSuperAdmin ? 'Platform Super Admin' : (user?.role || 'Staff')}</span>
            </div>
          </div>

          {showProfileMenu && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 8px)',
                width: '240px',
                background: 'white',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-xl)',
                border: '1px solid var(--border-subtle)',
                zIndex: 50,
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--slate-100)', background: 'var(--slate-50)' }}>
                <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--slate-900)' }}>{user?.fullName || (isSuperAdmin ? 'Platform Super Admin' : 'Staff User')}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{user?.email}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '0.6875rem', color: 'var(--primary-blue)' }}>
                  <Building2 size={12} />
                  <span>{isSuperAdmin ? 'LMS Master Registry' : (tenant?.name || 'Assigned Laboratory')}</span>
                </div>
              </div>

              <div style={{ padding: '0.5rem' }}>
                <button
                  onClick={logout}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8125rem',
                    color: 'var(--danger-600)',
                    cursor: 'pointer',
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
