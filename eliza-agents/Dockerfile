# BagsWorld Agents Server Dockerfile
# Uses tsx to run TypeScript directly for simpler deployment

FROM node:20-alpine

WORKDIR /app

# Install curl for healthchecks (wget not available in slim alpine)
RUN apk add --no-cache curl

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

# Health check using curl
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Expose port
EXPOSE 3001

# Start server with tsx (runs TypeScript directly)
CMD ["npx", "tsx", "src/server.ts"]
