#!/bin/sh
set -eu

cd "$(dirname "$0")"

if [ "$(id -u)" != 0 ]; then
  echo 'Run this script with sudo.' >&2
  exit 1
fi

LAN_STOREFRONT_IP=${LAN_STOREFRONT_IP:-10.20.69.159}
export LAN_STOREFRONT_IP

case "$LAN_STOREFRONT_IP" in
  10.*|192.168.*|172.16.*|172.17.*|172.18.*|172.19.*|172.2?.*|172.30.*|172.31.*) ;;
  *)
    echo 'LAN_STOREFRONT_IP must be a private-network address.' >&2
    exit 1
    ;;
esac

if ! ip -4 -o addr show | awk '{print $4}' | cut -d/ -f1 | grep -Fxq "$LAN_STOREFRONT_IP"; then
  echo "The VM does not currently own $LAN_STOREFRONT_IP." >&2
  exit 1
fi

compose() {
  docker compose \
    -f compose.yaml \
    -f compose.apps.yaml \
    -f compose.preview.yaml \
    -f compose.lan.yaml \
    "$@"
}

config_file=$(mktemp)
trap 'rm -f "$config_file"' EXIT HUP INT TERM
chmod 0600 "$config_file"
compose config --format json > "$config_file"
python3 validate-lan-compose.py "$config_file" "$LAN_STOREFRONT_IP"

compose up -d --no-deps storefront

attempt=0
until wget -q -O /dev/null "http://$LAN_STOREFRONT_IP:18000/us"; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo 'Storefront did not become ready on the LAN address.' >&2
    exit 1
  fi
  sleep 2
done

echo "LAN_STOREFRONT_READY http://$LAN_STOREFRONT_IP:18000/us"
