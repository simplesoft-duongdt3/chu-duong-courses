#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "🚀 Starting Deployment Process..."

# 1. Build the static site (convert Markdown to HTML)
echo "📦 Building static site from markdown..."
if command -v node &> /dev/null; then
    node build.js
else
    echo "❌ Error: Node.js is not installed. Cannot build content."
    exit 1
fi

# 2. Build and Start Docker Container
echo "🐳 Building and starting Docker container..."
docker-compose up -d --build

echo "✅ Deployment Successful!"
echo "🌍 Access the site at: http://localhost:8080"
