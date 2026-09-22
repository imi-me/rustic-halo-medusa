import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
const algorithm = 'aes-256-gcm'
function keyFromEnvironment(value: string | undefined) {
  if (!value) throw new Error('Etsy token encryption is not configured.')
  const key = Buffer.from(value, 'base64url')
  if (key.length !== 32) throw new Error('Etsy token encryption is not configured.')
  return key
}
export function encryptEtsyToken(token: string, encryptionKey = process.env.ETSY_TOKEN_ENCRYPTION_KEY) {
  if (!token || token.length > 4096) throw new Error('Invalid Etsy token.')
  const iv = randomBytes(12), cipher = createCipheriv(algorithm, keyFromEnvironment(encryptionKey), iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return `v1.${iv.toString('base64url')}.${encrypted.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}`
}
export function decryptEtsyToken(envelope: string, encryptionKey = process.env.ETSY_TOKEN_ENCRYPTION_KEY) {
  const [version, ivValue, encryptedValue, tagValue, ...extra] = envelope.split('.')
  if (version !== 'v1' || !ivValue || !encryptedValue || !tagValue || extra.length) throw new Error('Invalid Etsy token envelope.')
  try {
    const decipher = createDecipheriv(algorithm, keyFromEnvironment(encryptionKey), Buffer.from(ivValue, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]).toString('utf8')
  } catch { throw new Error('Invalid Etsy token envelope.') }
}
