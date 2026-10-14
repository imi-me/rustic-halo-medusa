import { PolicyOperation } from '@medusajs/framework/utils'
import { defineMiddlewares } from '@medusajs/framework/http'
import { guardAppleStaffActor } from '../lib/apple-admin/actor-guard'
import { appleStart } from '../lib/apple-admin/http'
import { limitPasswordReset } from '../lib/email/reset-rate-limit'

import { guardResetReplay } from '../lib/email/reset-replay-guard'

import { guardHairClawOffer } from '../lib/guard-hair-claw-offer'

export default defineMiddlewares({
  routes: [{
    matcher: '/admin/shipping-packages/preview', method: ['POST'], policies: [{ resource: 'shipping_option', operation: PolicyOperation.read }, { resource: 'product', operation: PolicyOperation.read }], middlewares: [],
  }, {
    matcher: '/admin/shipping-packages', method: ['GET'], policies: [{ resource: 'shipping_option', operation: PolicyOperation.read }], middlewares: [],
  }, {
    matcher: '/admin/shipping-packages', method: ['POST'], policies: [{ resource: 'shipping_option', operation: PolicyOperation.update }], middlewares: [],
  }, {
    matcher: '/admin/assistant/product-copy', method: ['POST'],
    bodyParser: { sizeLimit: '5mb' }, middlewares: [],
  }, {

    matcher: '/admin/product-workspace', method: ['POST'],
    policies: [{ resource: 'product', operation: PolicyOperation.create }, { resource: 'product_variant', operation: PolicyOperation.create }, { resource: 'inventory_item', operation: PolicyOperation.create }, { resource: 'inventory_level', operation: PolicyOperation.create }, { resource: 'price', operation: PolicyOperation.create }], middlewares: [],
  }, {
    matcher: '/admin/products/:id/workspace/options', method: ['POST'],
    policies: [{ resource: 'product', operation: PolicyOperation.update }, { resource: 'product_option', operation: [PolicyOperation.create, PolicyOperation.update, PolicyOperation.delete] }], middlewares: [],
  }, {
    matcher: '/admin/products/:id/workspace', method: ['POST'],
    policies: [{ resource: 'product', operation: PolicyOperation.update }, { resource: 'product_variant', operation: PolicyOperation.update }, { resource: 'price', operation: PolicyOperation.create }, { resource: 'price', operation: PolicyOperation.update }, { resource: 'price', operation: PolicyOperation.delete }], middlewares: [],
  }, {
    matcher: '/admin/products/:id/etsy-listing', method: ['POST'],
    policies: [{ resource: 'product', operation: PolicyOperation.update }], middlewares: [],
  }, {
    matcher: '/admin/orders/:id/shipping-label', method: ['GET'],
    policies: [{ resource: 'order', operation: PolicyOperation.read }], middlewares: [],
  }, {
    matcher: '/admin/orders/:id/shipping-label', method: ['POST'],
    policies: [{ resource: 'order', operation: PolicyOperation.update }, { resource: 'fulfillment', operation: PolicyOperation.create }, { resource: 'fulfillment', operation: PolicyOperation.update }], middlewares: [],
  }, {

    matcher: '/admin/products/:id/hair-claw-media',
    method: ['POST'],
    policies: [
      { resource: 'product', operation: PolicyOperation.update },
      { resource: 'product_variant', operation: PolicyOperation.create },
      { resource: 'product_variant', operation: PolicyOperation.update },
      { resource: 'inventory_item', operation: PolicyOperation.create },
      { resource: 'price', operation: PolicyOperation.create },
      { resource: 'price', operation: PolicyOperation.update },
    ],
    middlewares: [],
  }, {
    matcher: '/store/carts/:id/line-items',
    method: ['POST'],
    middlewares: [guardHairClawOffer],
  }, {
    matcher: '/admin/inventory-items/:id/inline-level/:location_id',
    method: ['POST'],
    policies: [{ resource: 'inventory_level', operation: PolicyOperation.update }],
    middlewares: [],
  }, {
    matcher: '/admin/inventory-items/:id/inline-level/:location_id',
    method: ['DELETE'],
    policies: [{ resource: 'inventory_level', operation: PolicyOperation.delete }],
    middlewares: [],
  }, {
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
