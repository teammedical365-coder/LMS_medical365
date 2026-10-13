/**
 * Lab Management System (LMS) - Standardized Notification Utility
 * Powered by react-hot-toast with deduplication & Medical365 theme alignment.
 */

import toast from 'react-hot-toast';

/**
 * Extract clean string message from error objects, strings, or API responses
 */
export const getErrorMessage = (err, fallback = 'Unable to save changes. Please try again.') => {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (err.response?.data?.message) return err.response.data.message;
  if (err.response?.data?.error) return err.response.data.error;
  if (err.message) return err.message;
  return fallback;
};

/**
 * Standardized notification dispatcher
 */
export const notify = {
  /**
   * Success toast (default 3.5s duration)
   */
  success: (message, options = {}) => {
    const text = typeof message === 'string' ? message : 'Operation completed successfully.';
    return toast.success(text, {
      id: options.id || text, // Deduplication by default
      duration: options.duration || 3500,
      ...options,
    });
  },

  /**
   * Error toast (default 4.5s duration)
   */
  error: (messageOrError, options = {}) => {
    const text = getErrorMessage(messageOrError, options.fallback || 'Unable to save changes. Please try again.');
    return toast.error(text, {
      id: options.id || text, // Deduplication by default
      duration: options.duration || 4500,
      ...options,
    });
  },

  /**
   * Warning toast (default 4s duration)
   */
  warning: (message, options = {}) => {
    const text = typeof message === 'string' ? message : String(message);
    return toast(text, {
      icon: '⚠️',
      id: options.id || text,
      duration: options.duration || 4000,
      style: {
        borderLeft: '4px solid #f59e0b',
        ...options.style,
      },
      ...options,
    });
  },

  /**
   * Information toast (default 3.5s duration)
   */
  info: (message, options = {}) => {
    const text = typeof message === 'string' ? message : String(message);
    return toast(text, {
      icon: 'ℹ️',
      id: options.id || text,
      duration: options.duration || 3500,
      style: {
        borderLeft: '4px solid #0284c7',
        ...options.style,
      },
      ...options,
    });
  },

  /**
   * Loading spinner toast
   */
  loading: (message = 'Processing...', options = {}) => {
    return toast.loading(message, options);
  },

  /**
   * Dismiss specific toast or all toasts
   */
  dismiss: (toastId) => {
    toast.dismiss(toastId);
  },

  /**
   * Wrap an async promise with automatic loading/success/error toasts
   */
  promise: (promise, messages = {}, options = {}) => {
    return toast.promise(
      promise,
      {
        loading: messages.loading || 'Processing request...',
        success: messages.success || 'Changes saved successfully.',
        error: (err) => getErrorMessage(err, messages.error || 'Unable to save changes. Please try again.'),
      },
      {
        ...options,
      }
    );
  },
};

export default notify;
