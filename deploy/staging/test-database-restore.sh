#!/bin/sh
# A logical database restore drill, not a full VM/files/secrets restore.
set -eu
umask 077
cd /home/shawnhouse/rustic-halo-staging
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_dir="database-backups/$stamp"
mkdir -p "$backup_dir"
backup_file="$backup_dir/staging.dump"
container="rh-restore-check-$stamp-$$"
compose(){ docker compose -f compose.yaml -f compose.apps.yaml "$@"; }
cleanup(){ docker rm -fv "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT HUP INT TERM
compose exec -T postgres pg_dump -U rustic_halo -d rustic_halo_staging -Fc > "$backup_file"
[ -s "$backup_file" ]
sha256sum "$backup_file" > "$backup_dir/SHA256SUMS"
# Trust applies only inside this disposable, network-isolated container.
docker run -d --name "$container" --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-bookworm >/dev/null
ready=0
for attempt in $(seq 1 30); do
 if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then ready=1; break; fi
 sleep 1
done
[ "$ready" -eq 1 ]
docker exec "$container" createdb -U postgres restore_check
docker exec -i "$container" pg_restore -U postgres -d restore_check --no-owner --no-privileges --exit-on-error < "$backup_file"
docker exec "$container" psql -U postgres -d restore_check -v ON_ERROR_STOP=1 -Atc 'SELECT json_build_object('\''orders'\'', (SELECT count(*) FROM "order"), '\''products'\'', (SELECT count(*) FROM product), '\''payments'\'', (SELECT count(*) FROM payment));'
printf 'DATABASE_RESTORE_VERIFIED backup=%s\n' "$backup_file"
