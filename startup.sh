#!/bin/bash
set -e

cd /home/site/wwwroot

# Install pnpm globally if not present
npm install -g pnpm@9

# Set NODE_PATH
export NODE_PATH=/usr/local/lib/node_modules:$NODE_PATH

# Set PORT to 8080 if not set (Azure default)
export PORT=${PORT:-8080}

# Install dependencies
pnpm install --frozen-lockfile

# Start the app
pnpm start
