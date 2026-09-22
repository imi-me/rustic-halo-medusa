// Read-only R2 export. Opaque local filenames prevent object-key path traversal.
const { createRequire } = require('node:module')
const { createHash } = require('node:crypto')
const fs = require('node:fs/promises')
const { createWriteStream } = require('node:fs')
const { pipeline } = require('node:stream/promises')
const path = require('node:path')

async function main() {
  const output = process.argv[2]
  if (!output?.startsWith('/tmp/rustic-halo-r2-backup-') || process.env.R2_BUCKET !== 'rustic-halo-images' || process.env.R2_STORAGE_ENABLED !== 'true') throw Error('Unexpected backup configuration')
  const providerRequire = createRequire(require.resolve('@medusajs/medusa/file-s3'))
  const { S3Client, ListObjectsV2Command, GetObjectCommand } = providerRequire('@aws-sdk/client-s3')
  const client = new S3Client({ region: 'auto', endpoint: process.env.R2_ENDPOINT, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY }, forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' })
  await fs.mkdir(output, { mode: 0o700 })
  const objects = []
  let token
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET, ContinuationToken: token }))
    for (const item of page.Contents || []) {
      const filename = createHash('sha256').update(item.Key).digest('hex') + '.bin'
      const result = await client.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: item.Key, IfMatch: item.ETag }))
      const hash = createHash('sha256')
      let bytes = 0
      async function* digest(source) { for await (const chunk of source) { bytes += chunk.length; hash.update(chunk); yield chunk } }
      await pipeline(result.Body, digest, createWriteStream(path.join(output, filename), { flags: 'wx', mode: 0o600 }))
      if (bytes !== item.Size) throw Error('Object size changed during backup')
      objects.push({ key: item.Key, filename, bytes, sha256: hash.digest('hex'), contentType: result.ContentType, cacheControl: result.CacheControl, etag: item.ETag })
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined
    if (page.IsTruncated && !token) throw Error('Incomplete object listing')
  } while (token)
  await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify({ bucket: process.env.R2_BUCKET, createdAt: new Date().toISOString(), objects }, null, 2), { mode: 0o600, flag: 'wx' })
  client.destroy()
  console.log(JSON.stringify({ exportedObjects: objects.length, bytes: objects.reduce((n, o) => n + o.bytes, 0) }))
}
main().catch(() => { console.error('R2 export failed; snapshot is incomplete. No remote objects changed.'); process.exitCode = 1 })
