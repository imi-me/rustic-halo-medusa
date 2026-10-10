import { defineWidgetConfig } from '@medusajs/admin-sdk'
import { Button, Container, Heading, Text } from '@medusajs/ui'
import { useEffect, useState } from 'react'

const AppleAdminProfile = () => {
  const [available, setAvailable] = useState(false)
  const [linked, setLinked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    fetch('/admin/apple-login', { credentials: 'include', cache: 'no-store' }).then(r => r.ok ? r.json() : undefined).then(data => {
      setAvailable(data?.available === true && data.origin === window.location.origin); setLinked(data?.linked === true)
    }).catch(() => {})
    const result = new URL(window.location.href).searchParams.get('apple')
    if (result === 'linked') setMessage('Apple is linked to your staff account.')
    if (result === 'failed') setMessage('Apple could not be linked. Your password sign-in remains available.')
  }, [])
  const link = async () => {
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/admin/apple-login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const data = await response.json()
      if (!response.ok || !data.location) throw new Error('Apple could not be linked. Please sign in again and retry.')
      window.location.assign(data.location)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Apple linking failed.'); setBusy(false) }
  }
  if (!available) return null
  return <Container className="flex flex-col gap-3">
    <Heading level="h2">Apple sign-in</Heading>
    <Text size="small">{linked ? 'Apple is linked to your invited staff account.' : 'Link your Apple account to sign in to this Admin. Your password remains available.'}</Text>
    {!linked && <Button type="button" variant="secondary" className="self-start" isLoading={busy} onClick={link}>Link Apple account</Button>}
    {message && <Text size="small" role="status">{message}</Text>}
  </Container>
}
export const config = defineWidgetConfig({ zone: 'profile.details.after' })
export default AppleAdminProfile
