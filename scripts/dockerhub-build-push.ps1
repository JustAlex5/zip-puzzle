<#
  Build API + gateway images, tag for Docker Hub, optionally push.
  Tag defaults to the first line of repo VERSION (semver). Avoid :latest.

  Usage (from repo root):
    $env:DOCKERHUB_USER = "your-dockerhub-username"
    .\scripts\dockerhub-build-push.ps1

  Or explicit version:
    .\scripts\dockerhub-build-push.ps1 -Username "youruser" -Tag "1.0.1" -Push

  First time: create two repositories on hub.docker.com:
    <username>/zip-puzzle-api
    <username>/zip-puzzle-gateway

  Then: docker login   (once per machine)
#>
param(
    [Parameter(Mandatory = $false)]
    [string] $Username,

    [string] $Tag,

    [switch] $Push
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Read-RepoVersion {
    $vf = Join-Path $root "VERSION"
    if (Test-Path $vf) {
        return (Get-Content $vf -Raw).Trim()
    }
    return "1.0.0"
}

$user = $Username
if (-not $user) { $user = $env:DOCKERHUB_USER }
if (-not $user) {
    Write-Error "Set DOCKERHUB_USER or pass -Username (your Docker Hub username)."
}

# Prefer repo VERSION so a leftover $env:TAG from deploy shells does not retag builds.
$tagResolved = if ($Tag) { $Tag } else { Read-RepoVersion }
if ($tagResolved -eq "latest") {
    Write-Warning "Using tag 'latest' is discouraged; prefer a semver from VERSION (e.g. $(Read-RepoVersion))."
}

$apiImage = "${user}/zip-puzzle-api:${tagResolved}"
$gwImage = "${user}/zip-puzzle-gateway:${tagResolved}"

Write-Host "Building $apiImage ..."
docker build -t $apiImage -f Backend/Zip.Service/Zip.Service/Dockerfile Backend/Zip.Service/Zip.Service

Write-Host "Building $gwImage ..."
docker build -t $gwImage -f Frontend/zip-angular/Dockerfile Frontend/zip-angular

if ($Push) {
    Write-Host "Pushing $apiImage ..."
    docker push $apiImage
    Write-Host "Pushing $gwImage ..."
    docker push $gwImage
    Write-Host "Done. Deploy with DOCKERHUB_USER=$user TAG=$tagResolved"
} else {
    Write-Host "Skipping push (use -Push). To push: docker push $apiImage; docker push $gwImage"
}

Write-Host ""
Write-Host "Swarm deploy (same user/tag):"
Write-Host "  `$env:DOCKERHUB_USER='$user'; `$env:TAG='$tagResolved'; docker stack deploy -c docker-stack.yml zip-puzzle"
