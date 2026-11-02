# syntax=docker/dockerfile:1
# Frontend do Finami — build estático (Vite) servido por nginx.
# As variáveis VITE_* são EMBUTIDAS no JavaScript durante o build: mudar um valor exige
# reconstruir a imagem. Nada aqui é segredo (tudo vai para o navegador).

# ---------------------------------------------------------------------------
# 1) Build
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Dependências primeiro (cache de camada enquanto package*.json não mudar)
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# URL base da API. Vazio = mesma origem (o nginx deste container encaminha /api/* para a API)
ARG VITE_API_URL=""
# Base path do React Router (vazio = raiz). Se usar, ajuste também o nginx.conf
ARG VITE_SITE_BASENAME=""
# OAuth Client ID público do Google (vazio = botão do Google oculto)
ARG VITE_GOOGLE_CLIENT_ID=""

ENV VITE_API_URL=${VITE_API_URL} \
    VITE_SITE_BASENAME=${VITE_SITE_BASENAME} \
    VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}

# tsc -b + vite build (sem testes na imagem)
RUN npm run build

# ---------------------------------------------------------------------------
# 2) Runtime
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-proxy.inc /etc/nginx/conf.d/finami-proxy.inc
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
