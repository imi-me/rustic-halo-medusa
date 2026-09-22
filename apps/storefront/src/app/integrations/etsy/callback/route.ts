import { NextRequest, NextResponse } from 'next/server'
import { decodeEtsySession } from '../session'

export const runtime = 'nodejs'
const backend = process.env.MEDUSA_BACKEND_URL || 'http://backend:9000'

export async function GET(request: NextRequest) {
  const clear = (response: NextResponse) => { response.cookies.set('rh_etsy_oauth', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/integrations/etsy', maxAge: 0 }); response.headers.set('Cache-Control', 'no-store'); return response }
  const code = request.nextUrl.searchParams.get('code'), state = request.nextUrl.searchParams.get('state'), session = decodeEtsySession(request.cookies.get('rh_etsy_oauth')?.value)
  if (!code || code.length > 4096 || !state || !session || session.expiresAt < Date.now() || session.state !== state) return clear(NextResponse.json({ message: 'Etsy authorization could not be verified.' }, { status: 400 }))
  try {
    const upstream = await fetch(new URL('/integrations/etsy/callback', backend), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, verifier: session.verifier }), cache: 'no-store' })
    if (!upstream.ok) return clear(NextResponse.json({ message: 'Etsy connection could not be completed.' }, { status: 502 }))
    return clear(NextResponse.json({ connected: true, message: 'Etsy is connected for owner-approved catalog maintenance.' }))
  } catch { return clear(NextResponse.json({ message: 'Etsy connection could not be completed.' }, { status: 502 })) }
}
