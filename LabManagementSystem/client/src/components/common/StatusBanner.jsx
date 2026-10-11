/**
 * Lab Management System (LMS) - Demonstration / Phase 1 Status Banner
 */

import React from 'react';
import { Info, AlertCircle } from 'lucide-react';

export function StatusBanner({
  type = 'info',
  badgeText = 'Phase 1 UI Foundation',
  message = 'Demonstration Shell: Metrics and records displayed below are simulated UI placeholders. No live database connection is active in Phase 1.',
}) {
  const Icon = type === 'warning' ? AlertCircle : Info;
  const bannerClass = type === 'warning' ? 'status-banner-warning' : 'status-banner-info';

  return (
    <div className={`status-banner ${bannerClass}`}>
      <div className="status-banner-content">
        <Icon size={18} />
        <div>
          <span className="status-banner-badge" style={{ marginRight: '8px' }}>
            {badgeText}
          </span>
          <span>{message}</span>
        </div>
      </div>
    </div>
  );
}

export default StatusBanner;
