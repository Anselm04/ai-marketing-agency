# Multi-stage build for production

# --- Backend ---
FROM node:20-alpine AS backend
WORKDIR /app/backend
COPY backend/package.json ./
RUN npm install --production
COPY backend/src ./src
EXPOSE 3001
CMD ["node", "src/index.js"]

# --- Frontend (build only) ---
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Nginx to serve frontend + proxy API ---
FROM nginx:alpine AS nginx
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
