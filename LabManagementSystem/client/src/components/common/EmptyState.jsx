/**
 * Lab Management System (LMS) - Empty State Component
 */

import React from 'react';
import { Inbox } from 'lucide-react';

export function EmptyState({
  title = 'No records found',
  description = 'There are no active entries to display in this view.',
  icon: Icon = Inbox,
  actionButton,
}) {
  return (
    <div className="state-container">
      <div style={{ color: 'var(--slate-400)', marginBottom: '0.75rem' }}>
        <Icon size={44} />
      </div>
      <h3 className="state-title">{title}</h3>
      <p className="state-desc">{description}</p>
      {actionButton && <div>{actionButton}</div>}
    </div>
  );
}

export default EmptyState;
