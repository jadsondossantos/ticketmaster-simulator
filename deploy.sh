#!/bin/bash
set -e

echo "Deploying Ticketmaster Simulator..."

# Install pnpm globally
npm install -g pnpm@9 || true

# Install dependencies
echo "Installing dependencies..."
pnpm install --frozen-lockfile

# Build is already done in GitHub Actions, but verify dist exists
if [ ! -d "dist" ]; then
    echo "Building backend..."
    pnpm run build
fi

# Build frontend if needed
if [ ! -d "ui/dist" ]; then
    echo "Building frontend..."
    cd ui
    pnpm install
    pnpm run build
    cd ..
fi

echo "Deployment complete!"
