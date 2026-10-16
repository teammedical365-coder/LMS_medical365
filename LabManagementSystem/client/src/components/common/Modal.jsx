/**
 * Lab Management System (LMS) - Modal Component
 */

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const SIZE_MAX_WIDTH = {
  sm: '440px',
  md: '580px',
  lg: '800px',
  xl: '1020px',
  full: '96vw',
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth,
  maxHeight,
  height,
  style,
  dialogStyle,
  bodyStyle,
  size = 'md',
  className = '',
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const resolvedMaxWidth = maxWidth || SIZE_MAX_WIDTH[size] || '580px';
  const mergedDialogStyle = {
    maxWidth: resolvedMaxWidth,
    width: '100%',
    ...(maxHeight ? { maxHeight } : {}),
    ...(height ? { height } : {}),
    ...dialogStyle,
    ...style,
  };

  return (
    <div
      className={`modal-backdrop ${className}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`modal-dialog modal-${size || 'md'}`}
        style={mergedDialogStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-icon"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={bodyStyle}>{children}</div>

        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export default Modal;

