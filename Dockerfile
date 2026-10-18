
FROM node:22-alpine

WORKDIR /app

# Install the required pnpm version
RUN npm install -g pnpm@12.11.2

# Copy dependency files first for Docker caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

# Copy the application source
COPY . .

ENV NODE_ENV=production

EXPOSE 8000

CMD ["pnpm", "start"]
