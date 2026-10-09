import { defineMiddlewares } from '@medusajs/framework/http'
import { limitPasswordReset } from '../lib/email/reset-rate-limit'

import { guardResetReplay } from '../lib/email/reset-replay-guard'

import { guardStripeWebhook } from '../lib/guard-stripe-webhook'
import { validateProductionPayment } from '../lib/validate-production-payment'

export default defineMiddlewares({
  routes: [{
    matcher: '/hooks/payment/stripe_stripe*',
    middlewares: [guardStripeWebhook],
  }, {
    matcher: '/store/payment-collections/:id/payment-sessions',
    method: ['POST'],
    middlewares: [validateProductionPayment],
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
