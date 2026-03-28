#!/usr/bin/env bash
# Build images tagged for docker-stack.yml. Tag defaults to repo VERSION (semver).
#
# Usage:
#   ./scripts/build-stack-images.sh [dockerhub_username] [tag]
#   DOCKERHUB_USER=justalex5 ./scripts/build-stack-images.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

read_repo_version() {
  if [[ -f "$ROOT/VERSION" ]]; then
    tr -d ' \t\r\n' < "$ROOT/VERSION"
  else
    echo "1.0.0"
  fi
}

USER="${DOCKERHUB_USER:-local}"
TAG="${TAG:-$(read_repo_version)}"

if [[ $# -ge 1 ]]; then
  USER="$1"
fi
if [[ $# -ge 2 ]]; then
  TAG="$2"
fi

if [[ "$TAG" == "latest" ]]; then
  echo "warning: using tag 'latest' is discouraged; use a semver from VERSION ($(read_repo_version))." >&2
fi

API_IMAGE="${USER}/zip-puzzle-api:${TAG}"
GW_IMAGE="${USER}/zip-puzzle-gateway:${TAG}"

echo "Building ${API_IMAGE} ..."
docker build -t "${API_IMAGE}" -f Backend/Zip.Service/Zip.Service/Dockerfile Backend/Zip.Service/Zip.Service

echo "Building ${GW_IMAGE} ..."
docker build -t "${GW_IMAGE}" -f Frontend/zip-angular/Dockerfile Frontend/zip-angular

echo "Done. Deploy: DOCKERHUB_USER=${USER} TAG=${TAG} docker stack deploy -c docker-stack.yml zip-puzzle"
