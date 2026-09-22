#!/bin/sh
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
exec 9>catalog-import.lock
flock -n 9 || { echo 'Catalog operation already running'; exit 1; }
exec > catalog-shipping-deployment.log 2>&1
compose() {
  if [ -f compose.preview.yaml ]; then
    docker compose -f compose.yaml -f compose.apps.yaml -f compose.preview.yaml "$@"
  else
    docker compose -f compose.yaml -f compose.apps.yaml "$@"
  fi
}
backup="catalog-shipping-before-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir "$backup"
cp source/apps/backend/src/modules/shippo-test/service.ts "$backup/service.ts"
for file in shipping-catalog.ts shipping-catalog.json; do
  if [ -f "source/apps/backend/src/lib/$file" ]; then cp "source/apps/backend/src/lib/$file" "$backup/$file"; fi
done
cp catalog-shipping-service.ts source/apps/backend/src/modules/shippo-test/service.ts
cp shipping-catalog.ts shipping-catalog.json source/apps/backend/src/lib/
compose build backend
compose up -d --no-deps --wait --wait-timeout 180 backend
compose exec -T backend node -e 'const {shippingItems}=require("./src/lib/shipping-catalog.js"); const c=require("./src/lib/shipping-catalog.json"); if(Object.keys(c).length!==913 || shippingItems([{quantity:1,variant_sku:"38462-2"},{quantity:1,variant_sku:"38258-CREAM"}]).some(i=>i.package_id!=="hair-claw-box"||i.weight_oz!==1)) process.exit(1); console.log("CATALOG_SHIPPING_VERIFIED 913");'
date -u '+CATALOG_SHIPPING_DEPLOYED %Y-%m-%dT%H:%M:%SZ' > catalog-shipping-status.txt
chown shawnhouse:shawnhouse catalog-shipping-status.txt
cat catalog-shipping-status.txt
