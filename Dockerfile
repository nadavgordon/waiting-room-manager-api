# Stage 1: Build the application
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Prune dev dependencies for production
RUN npm prune --production

# Stage 2: Create the production image
FROM node:22-alpine AS production

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Ensure the application runs as a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Create and set permissions for the database directory
RUN mkdir -p db && chown nestjs:nodejs db

USER nestjs

EXPOSE 3000

CMD ["node", "dist/main"]