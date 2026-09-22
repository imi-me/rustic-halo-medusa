#!/bin/sh
set -eu
cd "$(dirname "$0")"
if [ ! -s .env ]; then
  echo 'Missing staging .env; prepare the database password first.' >&2
  exit 1
fi
sudo docker compose config --quiet
sudo docker compose up -d --wait --wait-timeout 180
sudo docker compose ps
