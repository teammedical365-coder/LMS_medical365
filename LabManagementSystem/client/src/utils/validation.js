/**
 * Lab Management System (LMS) - Shared Form Validation Utilities
 */

/**
 * Standard Email Regex requiring valid domain and .com top-level domain
 * (e.g. name@domain.com, staff@hospital.com, patient@gmail.com)
 */
export const EMAIL_COM_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.com$/i;

/**
 * Check if email is valid and ends with .com
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmailCom(email) {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_COM_REGEX.test(email.trim());
}

/**
 * Validate email string with optional required check
 * @param {string} email
 * @param {boolean} isRequired
 * @returns {string} Error message, or empty string if valid
 */
export function validateEmailCom(email, isRequired = true) {
  if (!email || !String(email).trim()) {
    return isRequired ? 'Email address is required' : '';
  }
  if (!isValidEmailCom(email)) {
    return 'Email must be a valid email address ending with .com (e.g. name@domain.com)';
  }
  return '';
}
