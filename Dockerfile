# Build stage
FROM node:22-slim as builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Runtime stage
FROM node:22-slim

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules

COPY . .

# Build the TypeScript code
RUN npm run build

ENV NODE_ENV=production

CMD ["node", "dist/agent.js"]
