import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

export function emailSettings() {
  const local: Record<string, string> = {}
  const path = resolve(process.cwd(), '../../.local/resend.env')
  if (process.env.NODE_ENV !== 'production' && existsSync(path)) {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^([A-Z_]+)=(.*)$/)
      if (match) local[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2')
    }
  }
  const value = (name: string) => process.env[name] ?? local[name] ?? ''
  return {
    apiKey: value('RESEND_API_KEY'),
    from: value('RESEND_FROM') || 'Rustic Halo <orders@send.rustichalo.com>',
    replyTo: value('RESEND_REPLY_TO') || 'contact@rustichalo.com',
    logoUrl: value('EMAIL_LOGO_URL'),
    enabled: value('EMAIL_DELIVERY_ENABLED') === 'true',
  }
}
