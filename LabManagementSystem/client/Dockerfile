# ==============================================================================
# Lab Management System (LMS) - Frontend Multi-Stage Dockerfile
# ==============================================================================

# Stage 1: Build React SPA assets using Vite
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies cleanly
RUN npm ci --prefer-offline --no-audit

# Copy client source code
COPY . .

# Build arguments for Vite environment
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_APP_TITLE="Medical365 Laboratory Management System"

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_APP_TITLE=${VITE_APP_TITLE}

# Build production bundle to dist/
RUN npm run build

# Stage 2: Production Nginx Server
FROM nginx:1.27-alpine AS production

# Remove default nginx configuration and html
RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/*

# Copy Nginx reverse proxy configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled SPA static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# Health check probe against local Nginx endpoint
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --spider -q http://localhost:80/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
