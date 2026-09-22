#!/bin/sh
set -eu
cd /home/shawnhouse/rustic-halo-staging
test "$(id -u)" = 0
systemd-analyze verify rustic-halo-job-health.service rustic-halo-job-health.timer
install -d -m 0755 -o root -g root /usr/local/lib/rustic-halo-job-health /var/lib/rustic-halo-job-health
for file in publish-job-health.py read-job-health.py background-jobs.cjs; do
 install -m 0644 -o root -g root "$file" "/usr/local/lib/rustic-halo-job-health/$file"
done
install -m 0644 -o root -g root rustic-halo-job-health.service rustic-halo-job-health.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now rustic-halo-job-health.timer
systemctl start rustic-halo-job-health.service
python3 /usr/local/lib/rustic-halo-job-health/read-job-health.py
