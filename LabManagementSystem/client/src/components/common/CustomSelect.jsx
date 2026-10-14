import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

/**
 * CustomSelect - Accessible dropdown component that shows exactly 3 items at a time
 * with smooth vertical scrolling for subsequent items, matching Medical365 design system.
 * 
 * Props:
 * - value: string | number
 * - onChange: (e: { target: { value: string, name?: string } }) => void | (val: string) => void
 * - options: Array<string | { value: string | number, label: string | React.ReactNode, disabled?: boolean }>
 * - placeholder: string
 * - name: string
 * - id: string
 * - disabled: boolean
 * - required: boolean
 * - style: object
 * - maxVisibleItems: number (default: 3)
 */
export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select option...',
  name,
  id,
  disabled = false,
  required = false,
  style = {},
  className = '',
  maxVisibleItems = 3,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Normalize options
  const normalizedOptions = options.map((opt) => {
    if (opt !== null && typeof opt === 'object') {
      return {
        value: String(opt.value ?? ''),
        label: opt.label ?? opt.value ?? '',
        disabled: Boolean(opt.disabled),
      };
    }
    return {
      value: String(opt ?? ''),
      label: String(opt ?? ''),
      disabled: false,
    };
  });

  const selectedOpt = normalizedOptions.find((opt) => String(opt.value) === String(value));

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (opt) => {
    if (opt.disabled) return;
    setIsOpen(false);
    if (onChange) {
      // Support both event-style (e.target.value) and direct value
      const syntheticEvent = {
        target: {
          name: name || id || '',
          value: opt.value,
        },
      };
      onChange(syntheticEvent);
    }
  };

  const itemHeight = 38; // px per item
  const menuMaxHeight = maxVisibleItems * itemHeight; // 114px for 3 items

  return (
    <div
      ref={containerRef}
      className={`custom-select-container ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        ...style,
      }}
    >
      {/* Hidden input for HTML form validation */}
      {required && (
        <input
          type="text"
          value={value || ''}
          required={required}
          onChange={() => {}}
          tabIndex={-1}
          style={{
            opacity: 0,
            position: 'absolute',
            pointerEvents: 'none',
            left: '50%',
            bottom: 0,
            width: 1,
            height: 1,
          }}
        />
      )}

      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        name={name}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="form-select custom-select-trigger"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          textAlign: 'left',
          background: disabled ? '#f8fafc' : '#ffffff',
          color: selectedOpt && selectedOpt.value !== '' ? '#0f172a' : '#94a3b8',
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: '0.6rem 0.85rem',
          border: isOpen ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
          borderRadius: '8px',
          boxShadow: isOpen ? '0 0 0 3px rgba(37, 99, 235, 0.14)' : '0 1px 2px rgba(15, 23, 42, 0.04)',
          fontWeight: selectedOpt && selectedOpt.value !== '' ? 600 : 400,
          userSelect: 'none',
          gap: '8px',
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {selectedOpt && selectedOpt.value !== '' ? selectedOpt.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          style={{
            flexShrink: 0,
            color: '#64748b',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease',
          }}
        />
      </button>

      {/* Floating Options Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          className="custom-select-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 9999,
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
            maxHeight: `${menuMaxHeight}px`,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '4px 0',
          }}
        >
          {normalizedOptions.length === 0 ? (
            <div
              style={{
                padding: '8px 12px',
                fontSize: '0.825rem',
                color: '#94a3b8',
                textAlign: 'center',
              }}
            >
              No options available
            </div>
          ) : (
            normalizedOptions.map((opt, index) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <div
                  key={`${opt.value}-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(opt)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: `${itemHeight}px`,
                    padding: '8px 12px',
                    fontSize: '0.85rem',
                    cursor: opt.disabled ? 'not-allowed' : 'pointer',
                    color: opt.disabled ? '#94a3b8' : isSelected ? '#1d4ed8' : '#1e293b',
                    backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                    fontWeight: isSelected ? 700 : 500,
                    transition: 'background-color 0.1s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!opt.disabled && !isSelected) {
                      e.currentTarget.style.backgroundColor = '#f1f5f9';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!opt.disabled && !isSelected) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                  >
                    {opt.label}
                  </span>
                  {isSelected && (
                    <Check size={14} style={{ color: '#2563eb', flexShrink: 0, marginLeft: '8px' }} />
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
