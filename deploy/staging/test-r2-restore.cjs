// Restore only the known synthetic test image to a new key; never overwrite originals.
const { createRequire } = require('node:module')
const { createHash, randomUUID } = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const hash = b => createHash('sha256').update(b).digest('hex')
async function main() {
  const root = process.argv[2]
  if (!/^\/tmp\/rustic-halo-restore-check-[0-9-]+$/.test(root) || process.env.R2_BUCKET !== 'rustic-halo-images' || process.env.R2_STORAGE_ENABLED !== 'true') throw Error('Unexpected configuration')
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8'))
  const item = manifest.objects.find(o => o.key === 'cdn-connection-check-01M30GKKWR5E901E3EBS911Q25.svg')
  if (manifest.bucket !== 'rustic-halo-images' || !item || !/^[a-f0-9]{64}\.bin$/.test(item.filename) || item.bytes > 10000) throw Error('Unexpected backup')
  const body = await fs.readFile(path.join(root, item.filename))
  if (body.length !== item.bytes || hash(body) !== item.sha256) throw Error('Backup integrity failed')
  const sdk = createRequire(require.resolve('@medusajs/medusa/file-s3'))('@aws-sdk/client-s3')
  const client = new sdk.S3Client({region:'auto',endpoint:process.env.R2_ENDPOINT,credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY},forcePathStyle:true,requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'})
  const key = 'restore-check/' + randomUUID() + '.svg'
  await client.send(new sdk.PutObjectCommand({Bucket:manifest.bucket,Key:key,Body:body,ContentType:item.contentType,CacheControl:item.cacheControl,IfNoneMatch:'*'}))
  const restored = await client.send(new sdk.GetObjectCommand({Bucket:manifest.bucket,Key:key}))
  if (hash(await restored.Body.transformToByteArray()) !== item.sha256 || restored.ContentType !== item.contentType || restored.CacheControl !== item.cacheControl) throw Error('Restored object verification failed')
  const url = 'https://cdn.rustichalo.com/' + key
  const response = await fetch(url, {signal:AbortSignal.timeout(30000)})
  if (!response.ok || hash(Buffer.from(await response.arrayBuffer())) !== item.sha256) throw Error('CDN verification failed')
  console.log(JSON.stringify({result:'R2_RESTORE_VERIFIED',bytes:body.length,sha256:item.sha256,url}))
  client.destroy()
}
main().catch(() => { console.error('Restore test failed; no original objects were changed. A new restore-check object may remain.'); process.exitCode=1 })
