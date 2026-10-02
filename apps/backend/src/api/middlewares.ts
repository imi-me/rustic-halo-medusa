import { defineMiddlewares } from '@medusajs/framework/http'
import { limitPasswordReset } from '../lib/email/reset-rate-limit'

import { guardResetReplay } from '../lib/email/reset-replay-guard'

export default defineMiddlewares({
  routes: [{
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
