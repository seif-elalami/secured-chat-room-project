/**
 * security.js — Frontend Security Utilities
 *
 * Provides helper functions for:
 *  1. XSS prevention  — sanitizeMessage()
 *  2. Input validation — validateInput()
 *  3. CSRF tokens      — generateCSRFToken() / getCSRFToken()
 *  4. HTTPS enforcement — enforceHttps()
 *
 * No external dependencies required.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. XSS PREVENTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts potentially dangerous HTML characters to their safe entity equivalents.
 * Use this on ALL user-supplied content before rendering it in the DOM.
 *
 * Example:
 *   sanitizeMessage('<script>alert(1)</script>')
 *   → '&lt;script&gt;alert(1)&lt;/script&gt;'
 *
 * @param {string} text - Raw user input (message content, display names, etc.)
 * @returns {string} Safe, HTML-encoded string
 */
export function sanitizeMessage(text) {
  if (text === null || text === undefined) return '';
  if (typeof text !== 'string') text = String(text);

  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. INPUT VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates a form field value against a set of rules.
 *
 * Supported rules:
 *   { required: true }
 *   { minLength: 8 }
 *   { maxLength: 128 }
 *   { pattern: /regex/, message: 'Custom error' }
 *
 * @param {string} value - The field value to validate
 * @param {Object} rules - Validation rules
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateInput(value, rules = {}) {
  const str = typeof value === 'string' ? value.trim() : String(value ?? '');

  if (rules.required && str.length === 0) {
    return { valid: false, error: 'This field is required' };
  }

  if (rules.minLength && str.length < rules.minLength) {
    return {
      valid: false,
      error: `Must be at least ${rules.minLength} characters`,
    };
  }

  if (rules.maxLength && str.length > rules.maxLength) {
    return {
      valid: false,
      error: `Must be no more than ${rules.maxLength} characters`,
    };
  }

  if (rules.pattern && !rules.pattern.test(str)) {
    return {
      valid: false,
      error: rules.message || 'Invalid format',
    };
  }

  return { valid: true, error: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CSRF TOKEN (IN-MEMORY, PER-SESSION)
// ─────────────────────────────────────────────────────────────────────────────

// Stored in module-level variable — lives only in memory during the session.
// Never written to localStorage or sessionStorage.
let _csrfToken = null;

/**
 * Generates a cryptographically random CSRF token using the Web Crypto API.
 * Called once per session; subsequent calls to getCSRFToken() return
 * the cached value.
 *
 * @returns {string} A 32-byte hex CSRF token
 */
export function generateCSRFToken() {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  _csrfToken = Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return _csrfToken;
}

/**
 * Returns the current session's CSRF token, generating one if it doesn't
 * exist yet.
 *
 * Usage in axios interceptor:
 *   config.headers['X-CSRF-Token'] = getCSRFToken();
 *
 * @returns {string} The current CSRF token
 */
export function getCSRFToken() {
  if (!_csrfToken) {
    generateCSRFToken();
  }
  return _csrfToken;
}

/**
 * Clears the in-memory CSRF token.
 * Call this on logout so a new token is generated on next login.
 */
export function clearCSRFToken() {
  _csrfToken = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. HTTPS ENFORCEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Redirects the browser to the HTTPS equivalent of the current URL
 * if running in production and the protocol is http (not https).
 *
 * Call this once at app startup (e.g., in index.js before rendering).
 *
 * Safe in development — does nothing when running on localhost.
 */
export function enforceHttps() {
  const isDevelopment =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '';

  if (!isDevelopment && window.location.protocol === 'http:') {
    window.location.replace(
      window.location.href.replace(/^http:/, 'https:')
    );
  }
}
