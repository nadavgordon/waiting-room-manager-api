# Stage 1: Build the application
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Prune dev dependencies for production
RUN npm prune --production

# Stage 2: Create the production image
FROM node:22-alpine AS production

WORKDIR /app

# Install curl first, as root (default user for this stage initially)
RUN apk add --no-cache curl

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Ensure the application runs as a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Create and set permissions for the database directory
RUN mkdir -p db && chown nestjs:nodejs db

USER nestjs # Switch to the non-root user for running the application

EXPOSE 3000

# Healthcheck instruction
# --interval: How often to run the check (30 seconds)
# --timeout: How long to wait for a response (5 seconds)
# --start-period: Grace period for startup (15 seconds)
# --retries: Number of consecutive failures to consider unhealthy (3)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/health/ready || exit 1

CMD ["node", "dist/main"]