FROM node:20-alpine AS builder

WORKDIR /app

# 1) Copy only package manifests first → npm install layer is cached on code-only changes
COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/

RUN HUSKY=0 npm install --legacy-peer-deps

# 2) Copy source code (changes here do NOT re-run npm install)
COPY tsconfig.base.json ./
COPY prisma ./prisma/
COPY packages/shared ./packages/shared/
COPY apps/backend ./apps/backend/

# 3) Generate Prisma client
RUN npx prisma generate --schema=./prisma/schema.prisma

# 4) Build shared package then backend
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/backend

# ─── Production image ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl

# Same trick: package manifests first for cached npm install
COPY package.json ./
COPY prisma ./prisma/
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/

RUN npm pkg delete scripts.prepare && npm install --omit=dev --legacy-peer-deps

# Copy built artefacts from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

EXPOSE 3001

CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma && node apps/backend/dist/index.js"]
