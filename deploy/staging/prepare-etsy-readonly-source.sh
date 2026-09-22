#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
archive=${1:-"$root/deploy/staging/etsy-readonly-source.tgz"}
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/apps/backend/src/lib" "$work/apps/backend/src/modules" "$work/apps/backend/src/api/integrations" "$work/apps/storefront/src/app/integrations"
cp -R "$root/apps/backend/src/lib/etsy" "$work/apps/backend/src/lib/"
cp -R "$root/apps/backend/src/modules/etsy" "$work/apps/backend/src/modules/"
cp -R "$root/apps/backend/src/api/integrations/etsy" "$work/apps/backend/src/api/integrations/"
cp -R "$root/apps/storefront/src/app/integrations/etsy" "$work/apps/storefront/src/app/integrations/"
tar -czf "$archive" -C "$work" apps
printf '%s\n' "$archive"
