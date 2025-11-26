#!/bin/bash
# Build all sandbox Docker images

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_PREFIX="agent-sandbox"

echo "Building agent-sandbox Docker images..."
echo "========================================"

cd "$SCRIPT_DIR"

# Build base image
echo ""
echo "Building base image..."
docker build -t ${IMAGE_PREFIX}-base:latest -f Dockerfile.base .

# Build Python image
echo ""
echo "Building Python image..."
docker build -t ${IMAGE_PREFIX}-python:latest -f Dockerfile.python .

# Build Node image
echo ""
echo "Building Node image..."
docker build -t ${IMAGE_PREFIX}-node:latest -f Dockerfile.node .

# Build full stack image
echo ""
echo "Building full stack image..."
docker build -t ${IMAGE_PREFIX}-full:latest -f Dockerfile.full .

echo ""
echo "========================================"
echo "All images built successfully!"
echo ""
docker images | grep ${IMAGE_PREFIX}
