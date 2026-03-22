# Build images for docker-stack.yml (run from repo root).
# Usage:
#   .\scripts\build-stack-images.ps1 -Username justalex5
#   .\scripts\build-stack-images.ps1 -Username justalex5 -Tag v1.0.0
# Or set env: $env:DOCKERHUB_USER = "justalex5"
param(
    [Alias("User")]
    [string] $Username,

    [string] $Tag
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$tagResolved = if ($Tag) { $Tag } elseif ($env:TAG) { $env:TAG } else { "latest" }
$user = if ($Username) { $Username } elseif ($env:DOCKERHUB_USER) { $env:DOCKERHUB_USER } else { "local" }

$apiImage = "${user}/zip-puzzle-api:${tagResolved}"
$gwImage = "${user}/zip-puzzle-gateway:${tagResolved}"

Write-Host "Building $apiImage ..."
docker build -t $apiImage -f Backend/Zip.Service/Zip.Service/Dockerfile Backend/Zip.Service/Zip.Service

Write-Host "Building $gwImage ..."
docker build -t $gwImage -f Frontend/zip-angular/Dockerfile Frontend/zip-angular

Write-Host "Done. Deploy: `$env:DOCKERHUB_USER='$user'; `$env:TAG='$tagResolved'; docker stack deploy -c docker-stack.yml zip-puzzle"
if ($tagResolved -ne "latest") {
    Write-Host "Using TAG=$tagResolved - set the same when deploying."
}
