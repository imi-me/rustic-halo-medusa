import { NextResponse } from 'next/server'
import { encodeEtsySession } from '../session'

export const runtime = 'nodejs'
const backend = process.env.MEDUSA_BACKEND_URL || 'http://backend:9000'

export async function GET() {
  try {
    const upstream = await fetch(new URL('/integrations/etsy/start', backend), { cache: 'no-store' })
    if (!upstream.ok) return NextResponse.json({ message: 'Etsy connection is not ready.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    const authorization = await upstream.json() as { url?: unknown, state?: unknown, verifier?: unknown, expiresAt?: unknown }
    if (typeof authorization.url !== 'string' || typeof authorization.state !== 'string' || typeof authorization.verifier !== 'string' || typeof authorization.expiresAt !== 'number' || !Number.isSafeInteger(authorization.expiresAt)) throw new Error('invalid')
    const response = NextResponse.redirect(authorization.url, { status: 302 })
    response.cookies.set('rh_etsy_oauth', encodeEtsySession({ state: authorization.state, verifier: authorization.verifier, expiresAt: authorization.expiresAt }), { httpOnly: true, secure: true, sameSite: 'lax', path: '/integrations/etsy', maxAge: 600 })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch { return NextResponse.json({ message: 'Etsy connection is not ready.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }) }
}
