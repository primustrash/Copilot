FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY src/ ./src/
COPY config/ ./config/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    bash \
    curl \
    git \
    openssh-client \
    xdotool \
    && rm -rf /var/cache/apk/*

# Create necessary directories
RUN mkdir -p \
    /var/mcp/workspaces \
    /var/mcp/sandboxes \
    /var/log/mcp-server

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/config ./config
COPY package.json ./

# Set non-root user
RUN addgroup -S mcp && adduser -S mcp -G mcp
RUN chown -R mcp:mcp /app /var/mcp /var/log/mcp-server

USER mcp

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
