FROM node:20-alpine AS builder

WORKDIR /app

# 1) Copy only package manifests → npm install layer is cached on code-only changes
COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/frontend/package.json ./apps/frontend/

RUN HUSKY=0 npm install --legacy-peer-deps

# 2) Copy source code (changes here do NOT re-run npm install)
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared/
COPY apps/frontend ./apps/frontend/

# Inject public env at build time (Next.js bakes NEXT_PUBLIC_* into the bundle)
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build Next.js app (transpilePackages handles @finance-app/shared)
RUN npm run build --workspace=apps/frontend

# Ensure public folder exists even if empty
RUN mkdir -p apps/frontend/public

# ─── Production image ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy standalone output (includes bundled node_modules)
COPY --from=builder /app/apps/frontend/.next/standalone ./

# Copy static assets and public folder
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Standalone server.js is at apps/frontend/server.js inside the workdir
CMD ["node", "apps/frontend/server.js"]
