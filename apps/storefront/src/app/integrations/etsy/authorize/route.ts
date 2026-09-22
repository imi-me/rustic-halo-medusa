import { NextResponse } from 'next/server'
import { encodeEtsySession } from '../session'

export const runtime = 'nodejs'
const backend = process.env.MEDUSA_BACKEND_URL || 'http://backend:9000'

export async function GET() {
  try {
    const upstream = await fetch(new URL('/integrations/etsy/start', backend), { cache: 'no-store' })
    if (!upstream.ok) throw new Error('not ready')
    const authorization = await upstream.json() as { url?: unknown, state?: unknown, verifier?: unknown, expiresAt?: unknown }
    if (typeof authorization.url !== 'string' || typeof authorization.state !== 'string' || typeof authorization.verifier !== 'string' || typeof authorization.expiresAt !== 'number' || !Number.isSafeInteger(authorization.expiresAt)) throw new Error('invalid')
    const destination = new URL(authorization.url)
    if (destination.protocol !== 'https:' || destination.hostname !== 'www.etsy.com' || destination.pathname !== '/oauth/connect') throw new Error('invalid destination')

    const response = new NextResponse(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect Etsy</title>
<style>body{font-family:system-ui,sans-serif;max-width:36rem;margin:5rem auto;padding:0 1.5rem;color:#26211f}a{display:inline-block;margin-top:1rem;padding:.8rem 1.2rem;border-radius:.4rem;background:#26211f;color:white;text-decoration:none}p{line-height:1.5}</style></head>
<body><h1>Connect Etsy</h1><p>Continue to Etsy to approve the read-only order report permission. Rustic Halo will not request transaction write access.</p><a href="${destination.toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">Continue to Etsy</a></body></html>`, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'" },
    })
    response.cookies.set('rh_etsy_oauth', encodeEtsySession({ state: authorization.state, verifier: authorization.verifier, expiresAt: authorization.expiresAt }), { httpOnly: true, secure: true, sameSite: 'lax', path: '/integrations/etsy', maxAge: 600 })
    return response
  } catch {
    return NextResponse.json({ message: 'Etsy connection is not ready.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
