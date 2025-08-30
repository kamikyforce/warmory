#!/bin/bash

# Install system dependencies for canvas and better-sqlite3
apt-get update
apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev python3

# Set Node.js to use a compatible version
export NODE_OPTIONS="--max-old-space-size=1024"

# Install dependencies with verbose logging
npm ci --verbose

# Rebuild better-sqlite3 for the current platform
npm rebuild better-sqlite3