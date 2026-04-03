#!/bin/bash
set -euo pipefail

REGISTRY="ghcr.io/better-i18n"
TAG="${1:-latest}"

echo "Building images with tag: $TAG"

# Build all three images
docker build -f Dockerfile.api -t "$REGISTRY/support-api:$TAG" .
docker build -f Dockerfile.workers -t "$REGISTRY/support-workers:$TAG" .
docker build -f Dockerfile.web \
  --build-arg NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-https://support-api.better-i18n.com}" \
  --build-arg NEXT_PUBLIC_BASE_URL="${NEXT_PUBLIC_BASE_URL:-https://support.better-i18n.com}" \
  -t "$REGISTRY/support-web:$TAG" .

echo "Pushing images..."

docker push "$REGISTRY/support-api:$TAG"
docker push "$REGISTRY/support-workers:$TAG"
docker push "$REGISTRY/support-web:$TAG"

echo "Done! Deploy with: TAG=$TAG docker compose up -d"
