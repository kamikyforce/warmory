#!/bin/bash
set -e

# Install system dependencies for canvas
apt-get update
apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    pkg-config

# Use npm instead of bun for better compatibility
npm ci --no-optional

# Rebuild native dependencies
npm rebuild canvas
npm rebuild better-sqlite3