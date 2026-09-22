import { NextRequest } from 'next/server'

const snapshots = new Set(['catalog', 'inventory'])

// Cloudflare Access protects the staging host. This handler exposes exactly two
// authenticated GET snapshots and forwards no caller-selected backend paths.
export async function GET(request: NextRequest, { params }: { params: Promise<{ snapshot: string }> }) {
  const { snapshot } = await params
  if (!snapshots.has(snapshot)) return Response.json({ message: 'Not found.' }, { status: 404 })

  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return Response.json({ message: 'Unauthorized.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  const backend = process.env.MEDUSA_BACKEND_URL || 'http://backend:9000'
  const destination = new URL(`/integrations/marketsuite/${snapshot}`, backend)
  const offset = request.nextUrl.searchParams.get('offset')
  if (offset !== null) destination.searchParams.set('offset', offset)
  let hasUnsupportedParameter = false
  request.nextUrl.searchParams.forEach((_, key) => { if (key !== 'offset') hasUnsupportedParameter = true })
  if (hasUnsupportedParameter) {
    return Response.json({ message: 'Invalid inventory page.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const upstream = await fetch(destination, {
      headers: { Authorization: authorization, Accept: 'application/json' },
      cache: 'no-store',
    })
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return Response.json({ message: 'Inventory connection unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
