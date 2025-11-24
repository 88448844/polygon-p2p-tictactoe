# Build Stage
FROM node:22-alpine AS build

WORKDIR /app/frontend

# Install frontend dependencies (including dev deps for Vite)
COPY frontend/package*.json ./
RUN npm install

# Ensure Vite binary is executable (safety for Alpine)
RUN chmod +x node_modules/.bin/vite

# Copy source and build
COPY frontend/ ./
RUN npm run build

# Production Stage
FROM node:22-alpine

WORKDIR /app

# Install backend production dependencies only
COPY backend/package*.json ./
RUN npm install --only=production

# Copy backend source
COPY backend/ ./
# Copy built frontend assets
COPY --from=build /app/frontend/dist ./public

# Environment variables
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "server.js"]
