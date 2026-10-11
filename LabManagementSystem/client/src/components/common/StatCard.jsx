/**
 * Lab Management System (LMS) - Metric Stat Card Component
 * Medical365 Aesthetic: White rounded card with soft shadows, light borders, and pastel icon badges
 */

import React from 'react';

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  colorScheme = 'blue', // blue, cyan, teal, green, amber, purple, red
  badgeText,
}) {
  const schemeStyles = {
    blue: { bg: '#eff6ff', color: 'var(--primary-blue)' },
    cyan: { bg: '#ecfeff', color: 'var(--cyan-600)' },
    teal: { bg: 'var(--mint-bg)', color: 'var(--mint-text)' },
    green: { bg: 'var(--mint-bg)', color: 'var(--mint-text)' },
    amber: { bg: 'var(--warning-50)', color: 'var(--warning-700)' },
    purple: { bg: 'var(--purple-50)', color: 'var(--purple-700)' },
    red: { bg: 'var(--danger-50)', color: 'var(--danger-700)' },
  }[colorScheme] || { bg: '#f8fafc', color: 'var(--slate-700)' };

  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className="stat-card-label">{title}</span>
        {Icon && (
          <div className="stat-icon-wrap" style={{ backgroundColor: schemeStyles.bg, color: schemeStyles.color }}>
            <Icon size={20} />
          </div>
        )}
      </div>

      <div className="stat-value">{value}</div>

      <div className="stat-footer">
        {badgeText && (
          <span className="badge badge-slate" style={{ fontSize: '0.6875rem' }}>
            {badgeText}
          </span>
        )}
        {subtitle && <span>{subtitle}</span>}
      </div>
    </div>
  );
}

export default StatCard;
