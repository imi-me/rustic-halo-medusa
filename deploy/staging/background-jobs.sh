#!/bin/sh
# Run on the staging VM from its deployment directory.
set -eu
cd /home/shawnhouse/rustic-halo-staging
case "${1:-status}" in
 status) [ "$#" -le 1 ] ;;
 retry) [ "$#" -eq 2 ] ;;
 *) echo 'Usage: background-jobs.sh [status | retry JOB_ID]' >&2; exit 1 ;;
esac
docker compose -f compose.yaml -f compose.apps.yaml exec -T \
  -w /app/apps/backend/.medusa/server backend node - "$@" < background-jobs.cjs
