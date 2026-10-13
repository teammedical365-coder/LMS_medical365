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
      cardBg: 'linear-gradient(135deg, #f0f7ff 0%, #e0effe 100%)',
      border: '1px solid #bae6fd',
      bg: '#ffffff',
      color: '#0284c7',
      valColor: '#0369a1',
      labelColor: '#334155',
      subColor: '#64748b',
    },
    green: {
      cardBg: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
      border: '1px solid #bbf7d0',
      bg: '#ffffff',
      color: '#16a34a',
      valColor: '#15803d',
      labelColor: '#334155',
      subColor: '#64748b',
    },
    amber: {
      cardBg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
      border: '1px solid #fde68a',
      bg: '#ffffff',
      color: '#d97706',
      valColor: '#b45309',
      labelColor: '#334155',
      subColor: '#64748b',
    },
    orange: {
      cardBg: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
      border: '1px solid #fed7aa',
      bg: '#ffffff',
      color: '#ea580c',
      valColor: '#c2410c',
      labelColor: '#334155',
      subColor: '#64748b',
    },
    purple: {
      cardBg: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
      border: '1px solid #e9d5ff',
      bg: '#ffffff',
      color: '#9333ea',
      valColor: '#7e22ce',
      labelColor: '#334155',
      subColor: '#64748b',
    },
    cyan: {
      cardBg: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)',
      border: '1px solid #a5f3fc',
      bg: '#ffffff',
      color: '#0891b2',
      valColor: '#0e7490',
      labelColor: '#334155',
      subColor: '#64748b',
    },
    teal: {
      cardBg: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)',
      border: '1px solid #99f6e4',
      bg: '#ffffff',
      color: '#0d9488',
      valColor: '#0f766e',
      labelColor: '#334155',
      subColor: '#64748b',
    },
    red: {
      cardBg: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
      border: '1px solid #fecaca',
      bg: '#ffffff',
      color: '#dc2626',
      valColor: '#b91c1c',
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
