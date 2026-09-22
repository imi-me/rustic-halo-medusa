#!/bin/sh
set -eu
cd /home/shawnhouse/rustic-halo-staging
sh apply-studio-skus.sh
sh deploy-catalog-shipping.sh
