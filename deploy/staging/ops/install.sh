#!/bin/sh
set -eu
umask 077
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
unset PYTHONPATH PYTHONHOME DOCKER_HOST DOCKER_CONTEXT COMPOSE_FILE COMPOSE_PROJECT_NAME
base=/home/shawnhouse/rustic-halo-staging
package=$base/restricted-ops
root=/usr/local/lib/rustic-halo-ops
state=/var/lib/rustic-halo-ops
rule=/etc/sudoers.d/rustic-halo-ops
command=/usr/local/sbin/rustic-halo-ops
test "$(id -u)" = 0
for file in "$root" "$state" "$rule" "$command"; do
  if test -e "$file" || test -L "$file"; then echo 'An ops installation already exists; review before replacing it.'; exit 1; fi
done
installed=no
cleanup() {
  if [ "$installed" != yes ]; then
    rm -f "$rule" "$command"
    rm -rf "$root" "$state"
  fi
}
trap cleanup EXIT
# Copy reviewed helpers into root-owned locations before running them.
install -d -m 0700 -o root -g root "$root" "$root/docker-config" "$state"
install -m 0755 -o root -g root "$package/rustic-halo-ops.py" "$command"
install -m 0600 -o root -g root "$package/freeze-config.py" "$root/freeze-config.py"
install -m 0600 -o root -g root "$package/Dockerfile" "$root/Dockerfile"
cd "$base"
/usr/bin/docker compose -f compose.yaml -f compose.apps.yaml -f compose.preview.yaml config --format json > "$root/original.json"
/usr/bin/python3 -I "$root/freeze-config.py" "$root/original.json" "$root/compose.json"
rm "$root/original.json"
DOCKER_CONFIG="$root/docker-config" /usr/bin/docker compose --project-directory "$root" --env-file /dev/null -p rustic-halo-staging -f "$root/compose.json" config --quiet
cat > "$root/sudoers.pending" <<'RULE'
# Exact arguments only. No shells, arbitrary scripts, Docker CLI or database admin.
shawnhouse ALL=(root) NOPASSWD: /usr/local/sbin/rustic-halo-ops status, /usr/local/sbin/rustic-halo-ops deploy storefront, /usr/local/sbin/rustic-halo-ops deploy backend, /usr/local/sbin/rustic-halo-ops restart storefront, /usr/local/sbin/rustic-halo-ops restart backend
RULE
/usr/sbin/visudo -cf "$root/sudoers.pending"
install -m 0440 -o root -g root "$root/sudoers.pending" "$rule"
/usr/sbin/visudo -cf /etc/sudoers
/usr/sbin/runuser -u shawnhouse -- sudo -n "$command" status
installed=yes
echo 'RESTRICTED_OPS_INSTALLED'
