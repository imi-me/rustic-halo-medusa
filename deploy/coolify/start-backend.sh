#!/bin/sh
set -eu
umask 077
backup="/backups/staging-$(date -u +%Y%m%dT%H%M%SZ)-$$.dump"
pg_dump --dbname="$DATABASE_URL" --format=custom --no-owner --no-acl --file="$backup.partial"
mv "$backup.partial" "$backup"
echo 'Pre-migration database backup saved.'
/app/apps/backend/node_modules/.bin/medusa db:migrate --skip-scripts --execute-safe-links
exec setpriv --reuid=node --regid=node --init-groups --no-new-privs /app/apps/backend/node_modules/.bin/medusa start
