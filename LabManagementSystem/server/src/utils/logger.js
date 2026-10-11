/**
 * Lab Management System (LMS) - Structured Logger Utility
 */

export const logger = {
  info: (msg, meta) => {
    console.log(`[INFO]  [${new Date().toISOString()}] ${msg}`, meta ? JSON.stringify(meta) : '');
  },
  warn: (msg, meta) => {
    console.warn(`[WARN]  [${new Date().toISOString()}] ${msg}`, meta ? JSON.stringify(meta) : '');
  },
  error: (msg, meta) => {
    console.error(`[ERROR] [${new Date().toISOString()}] ${msg}`, meta ? JSON.stringify(meta) : '');
  },
  debug: (msg, meta) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] [${new Date().toISOString()}] ${msg}`, meta ? JSON.stringify(meta) : '');
    }
  },
};

export default logger;
