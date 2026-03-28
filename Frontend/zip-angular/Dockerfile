# Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Build Angular (same-origin API URLs for nginx gateway)
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx ng build --configuration docker

# Nginx: SPA + reverse proxy to API (internal service name `api`)
FROM nginx:alpine
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/gateway.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/zip-angular/browser /usr/share/nginx/html
EXPOSE 80
