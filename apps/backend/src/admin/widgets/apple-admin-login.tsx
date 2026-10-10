import { defineWidgetConfig } from '@medusajs/admin-sdk'
import { Button, Text } from '@medusajs/ui'
import { useEffect, useRef, useState } from 'react'

const AppleAdminLogin = () => {
  const [available, setAvailable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const finishing = useRef(false)
  useEffect(() => {
    fetch('/staff-apple/status', { credentials: 'include', cache: 'no-store' }).then(r => r.json()).then(data => {
      setAvailable(data.available === true && data.origin === window.location.origin)
    }).catch(() => {})
    const result = new URL(window.location.href).searchParams.get('apple')
    if (result === 'failed') setMessage('Apple sign-in could not be completed. Sign in with your password to link Apple in your profile.')
    if (result !== 'finish' || finishing.current) return
    finishing.current = true
    setBusy(true)
    history.replaceState(null, '', '/app/login')
    ;(async () => {
      try {
        const response = await fetch('/auth/user/apple-staff/callback', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        const data = await response.json()
        if (!response.ok || !data.token || data.mfa_required || data.verification_required) throw new Error('Sign in with your password to complete any additional security checks.')
        const session = await fetch('/auth/session', { method: 'POST', credentials: 'include', headers: { Authorization: `Bearer ${data.token}` } })
        if (!session.ok) throw new Error('Apple sign-in could not create a session.')
        const me = await fetch('/admin/users/me', { credentials: 'include', cache: 'no-store' })
        if (!me.ok) throw new Error('Apple sign-in did not authorize a staff account.')
        window.location.replace('/app/overview')
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Apple sign-in failed. Please use your password.'); setBusy(false) }
    })()
  }, [])
  const start = async () => {
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/staff-apple/start', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const data = await response.json()
      if (!response.ok || !data.location) throw new Error('Apple sign-in is unavailable. Please use your password.')
      window.location.assign(data.location)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Apple sign-in failed.'); setBusy(false) }
  }
  if (!available && !message && !busy) return null
  return <div className="mt-4 flex w-full max-w-[280px] flex-col items-center gap-3">
    {available && <Button type="button" variant="secondary" className="w-full" isLoading={busy} onClick={start}>Continue with Apple</Button>}
    {available && <Text size="small" className="text-ui-fg-subtle text-center">Invited staff only. Link Apple in your profile after your first password sign-in.</Text>}
    {message && <Text size="small" className="text-ui-fg-error text-center" role="alert">{message}</Text>}
  </div>
}
export const config = defineWidgetConfig({ zone: 'login.after' })
export default AppleAdminLogin
