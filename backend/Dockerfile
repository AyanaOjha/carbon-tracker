# ============================================================
# Hardened Production Dockerfile (Security-Optimized)
# 1. Minimal base image: Alpine Linux (reduces attack surface)
# 2. Non-root user: 'node' (UID 1000)
# 3. Production-only dependencies (excludes development tooling)
# 4. Multi-stage build pattern
# ============================================================

FROM node:20-alpine AS build

WORKDIR /usr/src/app

# Copy dependency specifications first to leverage Docker layer caching
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# ----------------- Final Stage -----------------
FROM node:20-alpine

# Set secure environment variables
ENV NODE_ENV=production
ENV PORT=5000

WORKDIR /usr/src/app

# Copy production node_modules from build stage
COPY --chown=node:node --from=build /usr/src/app/node_modules ./node_modules
COPY --chown=node:node . .

# Run as non-root user (Principle of Least Privilege)
USER node

# Expose internal listening port
EXPOSE 5000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/ || exit 1

# Launch application
CMD ["node", "server.js"]
