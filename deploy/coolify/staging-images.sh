#!/bin/sh
# Coolify's helper currently fails to forward the Compose host-network grant.
# Keep the grant explicit and scoped to this staging build, outside the image context.
set -eu
umask 077
cd "$(dirname "$0")/../.."
build_env=/artifacts/build-time.env
compose_file=deploy/coolify/git-apps.compose.yaml
[ -r "$build_env" ] || { echo 'Coolify build environment is unavailable.' >&2; exit 1; }
plan=$(mktemp /artifacts/rustic-halo-staging-bake.XXXXXX)
trap 'rm -f "$plan"' EXIT HUP INT TERM
docker compose --project-directory "$PWD" --env-file "$build_env" -f "$compose_file" build --print > "$plan"
docker buildx bake --file "$plan" --allow=network.host --load --pull backend storefront
