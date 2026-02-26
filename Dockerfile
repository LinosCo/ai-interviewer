# Use exact Node.js version required by Prisma 7.4.0 (>=22.12.0)
# Railway was providing 22.11.0 via Nixpacks which failed Prisma's preinstall check.
# Using a custom Dockerfile gives us full control over the Node.js version.
FROM node:22.12.0-slim

WORKDIR /app

# Install openssl (required by Prisma engine)
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Install dependencies
# prisma/ must be copied before npm ci because postinstall runs `prisma generate`
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Copy remaining source and build
COPY . .

ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV NODE_ENV=production

RUN npm run build

# Railway injects PORT=8080 at runtime; EXPOSE must match so Railway
# routes external traffic to the same port the app listens on.
EXPOSE 8080
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "start"]
