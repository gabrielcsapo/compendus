FROM node:22-slim

RUN apt-get update && apt-get install -y \
    git \
    graphicsmagick \
    ghostscript \
    && rm -rf /var/lib/apt/lists/* \
    && git config --global safe.directory '*'

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000 3001

# Increase Node.js memory limit for processing large files (CBR/PDF)
ENV NODE_OPTIONS="--max-old-space-size=4096"

CMD ["pnpm", "start"]
