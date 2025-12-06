# Multi-stage Dockerfile for Node.js applications
# Optimized for production with minimal attack surface

# syntax=docker/dockerfile:1

###################
# Build Stage
###################
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./

# Use BuildKit cache mount for faster rebuilds
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

###################
# Production Stage
###################
FROM gcr.io/distroless/nodejs22-debian12

# Set working directory
WORKDIR /app

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Run as non-root user (distroless provides 'nonroot' user)
USER nonroot

# Expose application port
EXPOSE 3000

# Health check endpoint
# Note: distroless has no shell, healthcheck must be handled by orchestrator

# Start application
CMD ["dist/index.js"]
