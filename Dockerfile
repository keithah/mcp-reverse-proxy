FROM node:20-alpine AS base

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

# Build the application
RUN npm run build

# Production image, copy all the files and run the application
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

# Install git for cloning repositories
RUN apk add --no-cache git

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/migrations ./src/migrations

# Create directories for data and logs
RUN mkdir -p data logs mcp-services && \
    chown -R nextjs:nodejs data logs mcp-services

USER nextjs

EXPOSE 8080
EXPOSE 3000

ENV PORT 8080
ENV HOSTNAME "0.0.0.0"

# Start both the backend and frontend
CMD ["sh", "-c", "node dist/index.js & node server.js"]