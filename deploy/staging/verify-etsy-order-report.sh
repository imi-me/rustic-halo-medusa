#!/bin/sh
set -eu
umask 077
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
unset PYTHONPATH PYTHONHOME DOCKER_HOST DOCKER_CONTEXT COMPOSE_FILE COMPOSE_PROJECT_NAME
test "$(id -u)" = 0 || { echo 'Run with sudo.' >&2; exit 1; }

output=/home/shawnhouse/etsy-order-report-verification.json
error_output=/home/shawnhouse/etsy-order-report-verification-error.txt
temporary=$(mktemp /home/shawnhouse/.etsy-order-report-verification.XXXXXX)
cleanup() { rm -f "$temporary"; }
trap cleanup EXIT
: > "$error_output"
chown shawnhouse:shawnhouse "$error_output"
chmod 0600 "$error_output"

if ! docker exec -i rustic-halo-staging-backend-1 node > "$temporary" 2> "$error_output" <<'NODE'
const { Client } = require('pg')
const { refreshEtsyAccessToken, listEtsyShopReceipts } = require('/app/apps/backend/.medusa/server/src/lib/etsy/client.js')
const { decryptEtsyToken } = require('/app/apps/backend/.medusa/server/src/lib/etsy/token-vault.js')
const { reportWindow, summarizeEtsyReceipt } = require('/app/apps/backend/.medusa/server/src/lib/etsy/order-report.js')

;(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  const result = await db.query('select shop_id, encrypted_refresh_token, scopes from etsy_connection where deleted_at is null')
  await db.end()
  if (result.rows.length !== 1) throw new Error('Etsy connection count needs review.')
  const connection = result.rows[0]
  const scopes = Array.isArray(connection.scopes?.granted) ? connection.scopes.granted.filter(value => typeof value === 'string') : []
  if (!scopes.includes('transactions_r') || scopes.includes('transactions_w')) throw new Error('Unexpected Etsy transaction scopes.')
  const keystring = process.env.ETSY_API_KEY?.trim()
  const secret = process.env.ETSY_SHARED_SECRET?.trim()
  if (!keystring || !secret) throw new Error('Etsy configuration is incomplete.')
  const refreshed = await refreshEtsyAccessToken({ keystring, secret, refreshToken: decryptEtsyToken(connection.encrypted_refresh_token) })
  const window = reportWindow(30)
  const page = await listEtsyShopReceipts({
    keystring,
    secret,
    accessToken: refreshed.access_token,
    shopId: Number(connection.shop_id),
    minCreated: window.minCreated,
    maxCreated: window.maxCreated,
    offset: 0,
    limit: 100,
  })
  const summaries = page.receipts.map(summarizeEtsyReceipt)
  const keys = new Set()
  const collect = value => {
    if (Array.isArray(value)) return value.forEach(collect)
    if (!value || typeof value !== 'object') return
    for (const [key, child] of Object.entries(value)) { keys.add(key); collect(child) }
  }
  summaries.forEach(collect)
  const forbidden = ['buyer_user_id', 'email', 'name', 'first_line', 'second_line', 'city', 'state', 'zip', 'country_iso'].filter(key => keys.has(key))
  if (forbidden.length) throw new Error('Private buyer fields appeared in the sanitized report.')
  process.stdout.write(JSON.stringify({
    checkedAt: new Date().toISOString(),
    connected: true,
    transactionReadScope: true,
    transactionWriteScope: false,
    days: 30,
    total: page.total,
    fetched: summaries.length,
    privacy: { buyerIdentityIncluded: false, shippingAddressIncluded: false, rawResponseStored: false },
    inventorySyncEnabled: false,
    medusaOrdersCreated: false,
  }, null, 2) + '\n')
})().catch(error => {
  process.stderr.write((error instanceof Error ? error.message : 'Verification failed.') + '\n')
  process.exitCode = 1
})
NODE
then
  echo ETSY_ORDER_REPORT_LIVE_VERIFICATION_FAILED >&2
  exit 1
fi

rm -f "$error_output"
chown shawnhouse:shawnhouse "$temporary"
chmod 0600 "$temporary"
mv "$temporary" "$output"
trap - EXIT
echo ETSY_ORDER_REPORT_LIVE_VERIFIED
