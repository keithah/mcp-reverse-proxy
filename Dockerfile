FROM node:20-alpine AS base

# Install Redis in the base image
RUN apk add --no-cache redis supervisor

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat git
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application (skip TypeScript checking for now)
RUN npm run build:backend -- --skipLibCheck --noCheck && npm run build

# Fix ES module imports by adding .js extensions
RUN find ./dist -name "*.js" -exec sed -i "s/from '\.\([^']*\)'/from '.\1.js'/g" {} \; && \
    find ./dist -name "*.js" -exec sed -i "s/import('\.\([^']*\)')/import('.\1.js')/g" {} \;

# Production image, copy all the files and run the application
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install git for cloning repositories and Redis
RUN apk add --no-cache git redis supervisor

# Create users (redis user already exists in Alpine)
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Create directories for data, logs, Redis, public, and other resources
RUN mkdir -p data logs mcp-services backups certs public /var/run/redis /var/log/redis && \
    chown -R nextjs:nodejs data mcp-services backups certs public && \
    chown -R root:root logs && \
    chmod 755 logs && \
    chown redis:redis /var/run/redis /var/log/redis

# Create supervisor configuration
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 8437
EXPOSE 3437
EXPOSE 8443

ENV HOSTNAME="0.0.0.0"

# Start services with supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]