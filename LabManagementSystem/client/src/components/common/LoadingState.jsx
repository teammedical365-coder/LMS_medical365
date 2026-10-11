/**
 * Lab Management System (LMS) - Loading State Component
 */

import React from 'react';

export function LoadingState({ message = 'Loading laboratory records...' }) {
  return (
    <div className="state-container">
      <div className="spinner" />
      <p className="state-title">Processing</p>
      <p className="state-desc">{message}</p>
    </div>
  );
}

export default LoadingState;
