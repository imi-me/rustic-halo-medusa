import { AppleAdminConfig, APPLE_ISSUER } from './config'
import type { JWTVerifyGetKey } from 'jose' with { 'resolution-mode': 'import' }

let jwks: JWTVerifyGetKey | undefined
export async function verifyAppleToken(token: string, nonce: string, config: AppleAdminConfig, key?: JWTVerifyGetKey | CryptoKey) {
  const jose = await import('jose')
  jwks ??= jose.createRemoteJWKSet(new URL(APPLE_ISSUER + '/auth/keys'), { timeoutDuration: 10000 })
  const { payload } = await jose.jwtVerify(token, (key ?? jwks) as JWTVerifyGetKey, {
    algorithms: ['RS256'], issuer: APPLE_ISSUER, audience: config.clientId,
    requiredClaims: ['sub', 'iat', 'exp', 'nonce'], maxTokenAge: '10m', clockTolerance: 10,
  })
  if (payload.nonce !== nonce || typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 255) throw new Error('Invalid Apple identity')
  // Email/name are never authorization or account-linking evidence.
  return APPLE_ISSUER + '|' + payload.sub
}
export async function exchangeAppleCode(code: string, nonce: string, config: AppleAdminConfig) {
  if (!code || code.length > 4096) throw new Error('Invalid Apple authorization code')
  const jose = await import('jose')
  const privateKey = await jose.importPKCS8(config.privateKey, 'ES256')
  const assertion = await new jose.SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: config.keyId })
    .setIssuer(config.teamId).setSubject(config.clientId).setAudience(APPLE_ISSUER)
    .setIssuedAt().setExpirationTime('5m').sign(privateKey)
  const response = await fetch(APPLE_ISSUER + '/auth/token', { method: 'POST', redirect: 'error',
    signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: config.clientId,
      client_secret: assertion, redirect_uri: config.callback }) })
  if (!response.ok) throw new Error('Apple token exchange failed')
  const result = await response.json() as { id_token?: unknown }
  if (typeof result.id_token !== 'string' || result.id_token.length > 16384) throw new Error('Missing Apple identity token')
  return verifyAppleToken(result.id_token, nonce, config)
}
