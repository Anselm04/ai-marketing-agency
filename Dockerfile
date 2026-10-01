# Multi-stage production build for TrillionAI Marketing
# docker-compose uses `backend` and `nginx` targets.
# Fly uses `production`: one Node process serves API + built SPA.
# npm install (not ci) because this repo has no package-lock files.

# --- Backend Stage ---
FROM node:22-alpine AS backend
RUN apk add --no-cache ffmpeg font-dejavu
WORKDIR /app/backend
COPY backend/package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY backend/src ./src
COPY backend/data ./data
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3001/health || exit 1
ENV NODE_ENV=production
CMD ["node", "src/index.js"]

# --- Frontend Build Stage ---
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# --- Nginx Production Stage (docker-compose frontend) ---
FROM nginx:alpine AS nginx
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# --- Combined Fly production: API + static frontend ---
FROM node:22-alpine AS production
RUN apk add --no-cache wget ffmpeg font-dejavu
WORKDIR /app/backend
COPY backend/package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY backend/src ./src
COPY backend/data ./data
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist
ENV NODE_ENV=production
ENV PORT=8080
ENV FRONTEND_DIST=/app/frontend/dist
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1
CMD ["node", "src/index.js"]
