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
  colorScheme = 'blue', // blue, cyan, teal, green, amber, orange, purple, red
  badgeText,
  style = {},
}) {
  const schemeStyles = {
    blue: {
      cardBg: '#ffffff',
      border: '1px solid #e2e8f0',
      bg: '#eff6ff',
      color: '#0284c7',
      valColor: '#0369a1',
      labelColor: '#334155',
      subColor: '#64748b',
    },
    green: {
      cardBg: '#ffffff',
      border: '1px solid #e2e8f0',
      bg: '#f0fdf4',
      color: '#16a34a',
      valColor: '#15803d',
      labelColor: '#334155',
      subColor: '#64748b',
    },
    amber: {
      cardBg: '#ffffff',
      border: '1px solid #e2e8f0',
      bg: '#fffbeb',
      color: '#d97706',
      valColor: '#b45309',
      labelColor: '#334155',
      subColor: '#64748b',
    },
    orange: {
      cardBg: '#ffffff',
      border: '1px solid #e2e8f0',
      bg: '#fff7ed',
      color: '#ea580c',
      valColor: '#c2410c',
      labelColor: '#334155',
      subColor: '#64748b',
    },
    purple: {
      cardBg: '#ffffff',
      border: '1px solid #e2e8f0',
      bg: '#faf5ff',
      color: '#9333ea',
      valColor: '#7e22ce',
      labelColor: '#334155',
      subColor: '#64748b',
    },
    cyan: {
      cardBg: '#ffffff',
      border: '1px solid #e2e8f0',
      bg: '#ecfeff',
      color: '#0891b2',
      valColor: '#0e7490',
      labelColor: '#334155',
      subColor: '#64748b',
    },
    teal: {
      cardBg: '#ffffff',
      border: '1px solid #e2e8f0',
      bg: '#f0fdfa',
      color: '#0d9488',
      valColor: '#0f766e',
      labelColor: '#334155',
      subColor: '#64748b',
    },
    red: {
      cardBg: '#ffffff',
      border: '1px solid #e2e8f0',
      bg: '#fef2f2',
      color: '#dc2626',
      valColor: '#b91c1c',
      labelColor: '#334155',
      subColor: '#64748b',
    },
    slate: {
      cardBg: '#ffffff',
      border: '1px solid #e2e8f0',
      bg: '#f8fafc',
      color: '#475569',
      valColor: '#1e293b',
      labelColor: '#334155',
      subColor: '#64748b',
    },
  }[colorScheme] || {
    cardBg: '#ffffff',
    border: '1px solid #e2e8f0',
    bg: '#f8fafc',
    color: 'var(--slate-700)',
    valColor: 'var(--text-main)',
    labelColor: 'var(--text-muted)',
    subColor: 'var(--text-muted)',
  };

  return (
    <div
      className="stat-card"
      style={{
        background: schemeStyles.cardBg,
        border: schemeStyles.border,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        transition: 'all 0.2s ease',
        ...style,
      }}
    >
      <div className="stat-card-top">
        <span className="stat-card-label" style={{ color: schemeStyles.labelColor }}>{title}</span>
        {Icon && (
          <div
            className="stat-icon-wrap"
            style={{
              backgroundColor: schemeStyles.bg,
              color: schemeStyles.color,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
            }}
          >
            <Icon size={20} />
          </div>
        )}
      </div>

      <div className="stat-value" style={{ color: schemeStyles.valColor }}>{value}</div>

      <div className="stat-footer">
        {badgeText && (
          <span className="badge badge-slate" style={{ fontSize: '0.6875rem' }}>
            {badgeText}
          </span>
        )}
        {subtitle && <span style={{ color: schemeStyles.subColor }}>{subtitle}</span>}
      </div>
    </div>
  );
}

export default StatCard;
