/**
 * Lab Management System (LMS) - HTTP Server Entry Point
 * 
 * Separates lifecycle management and port binding from Express app definition.
 */

import http from 'http';
import app from './app.js';
import config, { validateConfig } from './config/env.js';
import dbConnection from './config/db.js';
import logger from './utils/logger.js';

import net from 'net';

/**
 * Check if an already running process on the port is another LMS server instance
 */
async function checkExistingLmsServer(port) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`http://localhost:${port}/api/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const body = await res.json();
      return body?.data?.system?.includes('Lab Management System') ? true : false;
    }
  } catch {
    // Port is not an active HTTP server or timed out
  }
  return false;
}

/**
 * Bind HTTP server to port with Promise-based error handling
 */
function listenOnPort(server, port) {
  return new Promise((resolve, reject) => {
    function onError(err) {
      server.removeListener('listening', onListening);
      reject(err);
    }
    function onListening() {
      server.removeListener('error', onError);
      resolve(port);
    }
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port);
  });
}

/**
 * Attempt binding to desiredPort with automated fallback to adjacent ports
 */
async function startServerWithFallback(server, desiredPort, maxRetries = 5) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const portToTry = desiredPort + attempt;
    try {
      await listenOnPort(server, portToTry);
      return { port: portToTry, fellBack: attempt > 0, originalPort: desiredPort };
    } catch (err) {
      if (err.code === 'EADDRINUSE') {
        const isExistingLms = await checkExistingLmsServer(portToTry);
        if (isExistingLms) {
          logger.warn(`⚠️  [LMS Server] Another LMS Server instance is already active on port ${portToTry} (Health endpoint responsive: http://localhost:${portToTry}/api/health).`);
          logger.info(`ℹ️  Preventing port conflict: trying next available port...`);
        }
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Unable to bind server: ports ${desiredPort} through ${desiredPort + maxRetries} are all occupied.`);
}

async function bootstrap() {
  // 1. Validate environment configuration (Fail-fast in production per SEC-03)
  const validation = validateConfig();
  if (validation.errors && validation.errors.length > 0) {
    validation.errors.forEach((err) => logger.error(`[SEC-03] Fatal Configuration Error: ${err}`));
    logger.error('CRITICAL: Server startup aborted due to unsafe production configuration.');
    process.exit(1);
  }

  if (validation.warnings && validation.warnings.length > 0) {
    validation.warnings.forEach((warning) => logger.warn(`Configuration Notice: ${warning}`));
  }

  // 2. Initialize database connection
  try {
    const connResult = await dbConnection.connect();
    if (connResult.status === 'connected') {
      logger.info(`[LMS DB] Connected to MongoDB Atlas master database: ${connResult.dbName} (${connResult.host})`);
    }
  } catch (err) {
    logger.error('CRITICAL: Failed to connect to MongoDB Atlas database.', {
      error: err.message,
    });
    if (config.database.autoConnect) {
      logger.error('DB_AUTO_CONNECT=true is set: Live operations will fail safely with 503 DATABASE_UNAVAILABLE until Atlas credentials or network access are configured.');
    }
  }

  // 3. Create HTTP server with automated fallback
  const server = http.createServer(app);

  server.on('error', (err) => {
    logger.error('❌ [LMS Server] Runtime server error:', { error: err.message });
  });

  const bindResult = await startServerWithFallback(server, config.port, 5);
  const activePort = bindResult.port;

  if (bindResult.fellBack) {
    logger.warn(`⚠️  [LMS Server] Configured port ${bindResult.originalPort} was in use. Automatically bound to fallback port: ${activePort}`);
  }

  logger.info(`🚀 [LMS Server] Running in [${config.env}] mode on port ${activePort}`);
  logger.info(`🔗 Health check available at: http://localhost:${activePort}/api/health`);
  logger.info(`🔗 Versioned API available at: http://localhost:${activePort}${config.apiPrefix}/health`);
  logger.info(`🌐 Full Backend URL: http://localhost:${activePort}${config.apiPrefix}`);

  // 4. Graceful shutdown handling
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      logger.info('HTTP server closed.');
      await dbConnection.disconnect();
      process.exit(0);
    });

    // Force shutdown after timeout
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Fatal bootstrap error:', { error: err.message, stack: err.stack });
  process.exit(1);
});
