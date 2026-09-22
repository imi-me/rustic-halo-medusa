#!/bin/sh
set -eu

# Restores the staging SSH user's access to two source folders accidentally
# created by a prior privileged deployment. It does not change application data.
exec ssh -tt -S "$HOME/.ssh/rustic-halo.sock" shawnhouse@10.20.69.159 \
  'sudo chown -R shawnhouse:shawnhouse \
    "/home/shawnhouse/rustic-halo-staging/source/apps/storefront/src/app/[countryCode]/(main)/reset-password" \
    "/home/shawnhouse/rustic-halo-staging/source/apps/storefront/src/modules/account/components/password-reset"'
