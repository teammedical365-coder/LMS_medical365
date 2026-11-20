# ==============================================================================
# Lab Management System (LMS) - Server Dockerfile (Production Runtime)
# ==============================================================================

FROM node:20-alpine AS runtime

# Set non-root environment & production defaults
ENV NODE_ENV=production
ENV PORT=5000

WORKDIR /app

# Install curl and wget for container health check probes
RUN apk add --no-cache curl wget

# Copy package dependencies
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev --prefer-offline --no-audit

# Copy application source code
COPY src/ ./src/
COPY scripts/ ./scripts/

# Create persistent storage directories with proper permissions for non-root execution
RUN mkdir -p /app/backups /app/storage /app/logs \
    && chown -R node:node /app

# Switch to non-privileged user for security hardening
USER node

# Health check probe against local Express health endpoint
HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://localhost:5000/api/health || exit 1

EXPOSE 5000

CMD ["node", "src/server.js"]
