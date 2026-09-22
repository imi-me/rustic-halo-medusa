#!/bin/sh
set -eu
cd /home/shawnhouse/rustic-halo-staging
[ "$(id -u)" = 0 ] || { echo 'Run with sudo.' >&2; exit 1; }
umask 077
exec > password-recovery-deployment.log 2>&1
compose() {
  if [ -f compose.preview.yaml ]; then
    docker compose -f compose.yaml -f compose.apps.yaml -f compose.preview.yaml "$@"
  else
    docker compose -f compose.yaml -f compose.apps.yaml "$@"
  fi
}
compose config --quiet
# The source backup is private: it may include local server configuration.
backup="password-recovery-backup-$(date +%Y%m%d%H%M%S).tgz"
tar -czf "$backup" source
tar -xzf password-recovery-source.tgz -C source
# Both recovery flags default to off; global email delivery stays off in compose.
compose build backend storefront
compose up -d --no-deps --wait --wait-timeout 180 backend
compose up -d --no-deps storefront
compose ps
printf '\nPASSWORD_RECOVERY_DEPLOYMENT_COMPLETE\n'
