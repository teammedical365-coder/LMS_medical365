/**
 * Lab Management System (LMS) - Breadcrumbs Navigation
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const ROUTE_NAME_MAP = {
  dashboard: 'Dashboard',
  patients: 'Patients',
  orders: 'Lab Orders',
  samples: 'Samples',
  tests: 'Test Catalog',
  reports: 'Reports',
  billing: 'Billing',
  users: 'Users and Roles',
  settings: 'Lab Settings',
};

export function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  return (
    <nav className="breadcrumbs-bar" aria-label="Breadcrumb">
      <ol className="breadcrumb-list">
        <li>
          <Link to="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--slate-500)' }}>
            <Home size={14} />
            <span>Home</span>
          </Link>
        </li>

        {pathnames.map((segment, index) => {
          const to = `/${pathnames.slice(0, index + 1).join('/')}`;
          const isLast = index === pathnames.length - 1;
          const displayName = ROUTE_NAME_MAP[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);

          return (
            <React.Fragment key={to}>
              <li className="breadcrumb-separator">
                <ChevronRight size={14} />
              </li>
              <li>
                {isLast ? (
                  <span className="breadcrumb-active" aria-current="page">
                    {displayName}
                  </span>
                ) : (
                  <Link to={to} style={{ color: 'var(--slate-500)' }}>
                    {displayName}
                  </Link>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
