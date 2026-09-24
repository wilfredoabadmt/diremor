# =====================================================================
# DIREMOR SAC - Dockerfile de Producción para Coolify PaaS
# =====================================================================

# Etapa 1: Compilación de TypeScript
FROM node:20-alpine AS builder
WORKDIR /app

ENV NODE_ENV=development
COPY package*.json tsconfig.json ./
RUN npm ci --include=dev

COPY src/ ./src/
RUN npm run build

# Etapa 2: Imagen Ligera de Ejecución en Producción
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
RUN apk add --no-cache curl

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY database/ ./database/

EXPOSE 3000

# Usuario no root para mayor seguridad
USER node

CMD ["node", "dist/index.js"]
