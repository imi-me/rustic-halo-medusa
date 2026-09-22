#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
exec ssh -N \
  -o ControlMaster=auto -o ControlPersist=8h \
  -S "$HOME/.ssh/rustic-halo.sock" \
  -i "$ROOT/.local/staging-access/id_ed25519" \
  -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o HostKeyAlias=10.20.42.160 \
  -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 \
  -L 127.0.0.1:18000:127.0.0.1:18000 \
  -L 127.0.0.1:19000:127.0.0.1:19000 \
  shawnhouse@10.20.69.159
