# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for the monorepo
COPY package.json yarn.lock ./
COPY packages/web/package.json ./packages/web/
COPY packages/shared/package.json ./packages/shared/

RUN corepack enable && corepack prepare yarn@4.12.0 --activate
RUN yarn install --immutable

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/web ./packages/web

# Build shared package first
WORKDIR /app/packages/shared
RUN yarn build

# Build web app
WORKDIR /app/packages/web
RUN yarn build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 argus

# Copy built assets
COPY --from=builder /app/packages/web/dist ./dist
COPY --from=builder /app/packages/web/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Set ownership
RUN chown -R argus:nodejs /app

USER argus

EXPOSE 3000

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

CMD ["node", "dist/server/server.js"]
