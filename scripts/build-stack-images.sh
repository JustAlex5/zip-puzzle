#!/usr/bin/env bash
# Usage: ./scripts/build-stack-images.sh [dockerhub_username] [tag]
#   DOCKERHUB_USER=justalex5 TAG=latest ./scripts/build-stack-images.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

USER="${DOCKERHUB_USER:-local}"
TAG="${TAG:-latest}"

if [[ $# -ge 1 ]]; then
  USER="$1"
fi
if [[ $# -ge 2 ]]; then
  TAG="$2"
fi

API_IMAGE="${USER}/zip-puzzle-api:${TAG}"
GW_IMAGE="${USER}/zip-puzzle-gateway:${TAG}"

echo "Building ${API_IMAGE} ..."
docker build -t "${API_IMAGE}" -f Backend/Zip.Service/Zip.Service/Dockerfile Backend/Zip.Service/Zip.Service

echo "Building ${GW_IMAGE} ..."
docker build -t "${GW_IMAGE}" -f Frontend/zip-angular/Dockerfile Frontend/zip-angular

echo "Done. Deploy: DOCKERHUB_USER=${USER} TAG=${TAG} docker stack deploy -c docker-stack.yml zip-puzzle"
