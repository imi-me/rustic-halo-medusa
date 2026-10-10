import { defineMiddlewares } from '@medusajs/framework/http'
import { guardAppleStaffActor } from '../lib/apple-admin/actor-guard'
import { appleStart } from '../lib/apple-admin/http'
import { limitPasswordReset } from '../lib/email/reset-rate-limit'

import { guardResetReplay } from '../lib/email/reset-replay-guard'

export default defineMiddlewares({
  routes: [{
    // Medusa's native SSO button uses this route; use the same guarded start flow.
    matcher: '/auth/user/apple-staff',
    method: ['POST'],
    middlewares: [(req, res) => appleStart(req, res, 'login')],
  }, {
    matcher: '/auth/:actor_type/:auth_provider/callback',
    method: ['GET', 'POST'],
    middlewares: [guardAppleStaffActor],
  }, {
    matcher: '/staff-apple/callback',
    method: ['POST'],
    bodyParser: { sizeLimit: '32kb' },
    middlewares: [],
  }, {
    matcher: '/admin/hair-claw-media/upload',
    method: ['POST'],
    bodyParser: { sizeLimit: '12mb' },
    middlewares: [],
  }, {
    matcher: '/admin/hair-claw-media/prepare',
    method: ['POST'],
    bodyParser: { sizeLimit: '33mb' },
    middlewares: [],
  }, {
    matcher: '/auth/customer/emailpass/reset-password',
    method: ['POST'],
    middlewares: [limitPasswordReset],
  }, {
    matcher: '/auth/customer/emailpass/update',
    method: ['POST'],
    middlewares: [guardResetReplay],
  }, {
    matcher: '/integrations/etsy/webhooks',
    method: ['POST'],
    bodyParser: { preserveRawBody: true },
  }],
})
