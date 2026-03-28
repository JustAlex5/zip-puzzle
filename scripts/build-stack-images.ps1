# Build images for docker-stack.yml (run from repo root).
# Tag defaults to repo VERSION file (semver). Avoid :latest.
#
# Usage:
#   .\scripts\build-stack-images.ps1 -Username justalex5
#   .\scripts\build-stack-images.ps1 -Username justalex5 -Tag 1.0.1
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

function Read-RepoVersion {
    $vf = Join-Path $root "VERSION"
    if (Test-Path $vf) {
        return (Get-Content $vf -Raw).Trim()
    }
    return "1.0.0"
}

$tagResolved = if ($Tag) { $Tag } elseif ($env:TAG) { $env:TAG } else { Read-RepoVersion }
$user = if ($Username) { $Username } elseif ($env:DOCKERHUB_USER) { $env:DOCKERHUB_USER } else { "local" }

if ($tagResolved -eq "latest") {
    Write-Warning "Using tag 'latest' is discouraged; use a semver from VERSION (e.g. $(Read-RepoVersion))."
}

$apiImage = "${user}/zip-puzzle-api:${tagResolved}"
$gwImage = "${user}/zip-puzzle-gateway:${tagResolved}"

Write-Host "Building $apiImage ..."
docker build -t $apiImage -f Backend/Zip.Service/Zip.Service/Dockerfile Backend/Zip.Service/Zip.Service

Write-Host "Building $gwImage ..."
docker build -t $gwImage -f Frontend/zip-angular/Dockerfile Frontend/zip-angular

Write-Host "Done. Deploy: `$env:DOCKERHUB_USER='$user'; `$env:TAG='$tagResolved'; docker stack deploy -c docker-stack.yml zip-puzzle"
