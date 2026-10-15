# Build stage: compile the upstream TypeScript source
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Runtime stage
FROM node:22-alpine

# The MCP server speaks native Streamable HTTP (no stdio bridge needed):
# src/index.ts starts an HTTP server on $PORT (default 8088) directly.
# (node:alpine already ships the non-root 'node' user.)

WORKDIR /app

# Production dependencies only (no devDependencies like typescript)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/build ./build

# Copy entrypoint
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8088

# Non-root user.
USER node

ENTRYPOINT ["/docker-entrypoint.sh"]
