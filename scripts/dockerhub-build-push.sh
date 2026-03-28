#!/usr/bin/env bash
# Build API + gateway, tag for Docker Hub, optionally push.
# Tag defaults to the first line of repo VERSION (semver). Avoid :latest.
#
# Usage:
#   export DOCKERHUB_USER=your-dockerhub-username
#   ./scripts/dockerhub-build-push.sh
#   TAG=1.0.1 ./scripts/dockerhub-build-push.sh --push
#
# Create on hub.docker.com: <user>/zip-puzzle-api and <user>/zip-puzzle-gateway
# Then: docker login

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

PUSH=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --push) PUSH=true; shift ;;
    -h|--help) echo "Usage: DOCKERHUB_USER=<user> [TAG=semver from VERSION] $0 [--push]"; exit 0 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

USER="${DOCKERHUB_USER:-}"
TAG="${TAG:-$(read_repo_version)}"

if [[ -z "$USER" ]]; then
  echo "Set DOCKERHUB_USER to your Docker Hub username." >&2
  exit 1
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

if [[ "$PUSH" == true ]]; then
  echo "Pushing ${API_IMAGE} ..."
  docker push "${API_IMAGE}"
  echo "Pushing ${GW_IMAGE} ..."
  docker push "${GW_IMAGE}"
  echo "Done."
else
  echo "Skipping push. Run with --push or: docker push ${API_IMAGE} && docker push ${GW_IMAGE}"
fi

echo ""
echo "Swarm: DOCKERHUB_USER=${USER} TAG=${TAG} docker stack deploy -c docker-stack.yml zip-puzzle"
