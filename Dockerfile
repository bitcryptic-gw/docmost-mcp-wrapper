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

# Install Python and mcp-proxy (Python package for stdio-to-HTTP bridging)
RUN apk add --no-cache python3 py3-pip && \
    pip3 install --no-cache-dir mcp-proxy

# Create non-root user
RUN addgroup -g 1000 mcpuser && \
    adduser -u 1000 -G mcpuser -s /bin/sh -D mcpuser

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

# Non-root user. If the Tailscale hook requires root, override with:
#   --user root --cap-add=NET_ADMIN --cap-add=NET_RAW
USER mcpuser

ENTRYPOINT ["/docker-entrypoint.sh"]
