# Use exact Node.js version required by Prisma 7.4.0 (>=22.12.0)
# Railway was providing 22.11.0 via Nixpacks which failed Prisma's preinstall check.
# Using a custom Dockerfile gives us full control over the Node.js version.
FROM node:22.12.0-slim

WORKDIR /app

# Install openssl (required by Prisma engine)
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Install dependencies (cached layer - only re-runs if package files change)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .

ENV NODE_OPTIONS="--max-old-space-size=8192"
ENV NODE_ENV=production

RUN npm run build

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "start"]
