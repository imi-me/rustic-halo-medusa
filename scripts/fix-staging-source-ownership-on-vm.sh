#!/bin/sh
set -eu

# Run from the Proxmox VM console as root. This repairs ownership of the staged
# source tree only; it does not change application data, inventory, uploads, or
# service settings.
chown -R shawnhouse:shawnhouse "/home/shawnhouse/rustic-halo-staging/source"
