#!/bin/sh
set -eu
cd /home/shawnhouse/rustic-halo-staging
test "$(id -u)" = 0
test -f backup-r2.sh
test -f backup-r2.cjs
systemd-analyze verify rustic-halo-image-backup.service rustic-halo-image-backup.timer
install -m 0644 rustic-halo-image-backup.service /etc/systemd/system/rustic-halo-image-backup.service
install -m 0644 rustic-halo-image-backup.timer /etc/systemd/system/rustic-halo-image-backup.timer
systemctl daemon-reload
systemctl enable --now rustic-halo-image-backup.timer
systemctl list-timers rustic-halo-image-backup.timer --no-pager
