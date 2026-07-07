# ── Stage 1: Dependencies ──────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ── Stage 2: Production image ──────────────────────────────────────────────────
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy dependencies and source
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=appuser:appgroup . .

# Create required directories
RUN mkdir -p uploads logs && chown -R appuser:appgroup uploads logs

USER appuser

EXPOSE 5000

ENV NODE_ENV=production

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
