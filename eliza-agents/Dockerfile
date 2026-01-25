# BagsWorld Agents Server Dockerfile
# Uses tsx to run TypeScript directly for simpler deployment

FROM node:20-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S bagsworld && \
    adduser -S bagsworld -u 1001 -G bagsworld

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including tsx for runtime TypeScript execution)
RUN npm install && npm cache clean --force

# Copy source code
COPY src ./src

# Set ownership
RUN chown -R bagsworld:bagsworld /app

# Switch to non-root user
USER bagsworld

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Expose port
EXPOSE 3001

# Start server with tsx (runs TypeScript directly)
CMD ["npx", "tsx", "src/server.ts"]
