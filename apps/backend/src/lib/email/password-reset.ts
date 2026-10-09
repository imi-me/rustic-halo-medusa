import { EMAIL_TAGLINE, emailBrandHeader } from './branding'
import { createHash } from 'node:crypto'

export function passwordResetEmail(token: string, email: string, base: string) {
 const url = new URL(base)
 const local = ['localhost', '127.0.0.1'].includes(url.hostname)
 if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) throw Error('Invalid password reset URL')
 if (!token || !email) throw Error('Missing password reset details')
 url.searchParams.set('token', token)
 url.searchParams.set('email', email)
 const href = url.toString()
 const escaped = href.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
 return {
  subject: 'Reset your Rustic Halo password',
  text: `RUSTIC HALO\n${EMAIL_TAGLINE}\n\nReset your Rustic Halo password using this link:\n${href}\n\nIf you did not request this, you can ignore this email. If the link has expired, request a new one.`,
  html: `<table role="presentation" style="width:100%;max-width:600px;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#30362c" cellspacing="0" cellpadding="0">${emailBrandHeader()}<tr><td style="padding:32px"><h1>Reset your password</h1><p>Use the link below to choose a new Rustic Halo password.</p><p><a href="${escaped}">Choose a new password</a></p><p>If you did not request this, you can ignore this email. If the link has expired, request a new one.</p></td></tr></table>`,
 }
}
export function passwordResetKey(token: string) {
 return `password-reset/${createHash('sha256').update(token).digest('hex')}`
}
