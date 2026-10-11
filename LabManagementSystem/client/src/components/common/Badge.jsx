/**
 * Lab Management System (LMS) - Status Badge Component
 */

import React from 'react';

export function Badge({ children, variant = 'slate', icon: Icon, className = '' }) {
  const variantClass = `badge-${variant}`;

  return (
    <span className={`badge ${variantClass} ${className}`}>
      {Icon && <Icon size={12} />}
      {children}
    </span>
  );
}

export default Badge;
