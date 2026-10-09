import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

const stripeTestEnabled = process.env.STRIPE_TEST_ENABLED === 'true'
if (stripeTestEnabled) {
  if (!process.env.STRIPE_API_KEY?.startsWith('sk_test_')) {
    throw new Error('Stripe test mode requires a Stripe test secret key.')
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')) {
    throw new Error('Stripe test mode requires its webhook signing secret.')
  }
}

const persistentJobs = process.env.PERSISTENT_JOBS_ENABLED === 'true'
const r2Enabled = process.env.R2_STORAGE_ENABLED === 'true'
if (r2Enabled) {
  for (const name of ['R2_ENDPOINT', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) {
    if (!process.env[name]?.trim()) throw new Error(`R2 storage requires ${name}.`)
  }
}
if (persistentJobs && !process.env.REDIS_URL) {
  throw new Error('Persistent jobs require REDIS_URL.')
}

// HTTP is used only on loopback, inside the private staging SSH preview.
// Public deployments must keep Medusa's default Secure session cookies.
const localHttpAdmin = process.env.LOCAL_HTTP_ADMIN === 'true'
if (localHttpAdmin) {
  const origins = [process.env.ADMIN_CORS, process.env.AUTH_CORS]
  const loopbackOnly = origins.every(value => value && value.split(',').every(origin => {
    try {
      const url = new URL(origin.trim())
      return url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
    } catch { return false }
  }))
  if (process.env.APP_ENV !== 'staging' || !loopbackOnly) {
    throw new Error('LOCAL_HTTP_ADMIN requires staging and loopback-only admin/auth origins.')
  }
}

module.exports = defineConfig({
  modules: [{ resolve: './src/modules/social-media' }, { resolve: './src/modules/etsy' }, { resolve: './src/modules/hair-claw-media' }, ...(r2Enabled ? [{
    resolve: '@medusajs/medusa/file',
    options: { providers: [{
      resolve: '@medusajs/medusa/file-s3',
      id: 's3',
      options: {
        file_url: 'https://cdn.rustichalo.com',
        endpoint: process.env.R2_ENDPOINT,
        bucket: process.env.R2_BUCKET,
        access_key_id: process.env.R2_ACCESS_KEY_ID,
        secret_access_key: process.env.R2_SECRET_ACCESS_KEY,
        region: 'auto',
        acl: false,
        additional_client_config: {
          forcePathStyle: true,
          requestChecksumCalculation: 'WHEN_REQUIRED',
          responseChecksumValidation: 'WHEN_REQUIRED',
        },
      },
    }] },
  }] : []), ...(persistentJobs ? [
    {
      resolve: '@medusajs/medusa/event-bus-redis',
      options: {
        redisUrl: process.env.REDIS_URL,
        jobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { age: 86400, count: 1000 },
          removeOnFail: { age: 604800, count: 1000 },
        },
      },
    },
    {
      resolve: '@medusajs/medusa/workflow-engine-redis',
      options: { redis: { redisUrl: process.env.REDIS_URL } },
    },
    {
      resolve: '@medusajs/medusa/locking',
      options: { providers: [{
        resolve: '@medusajs/medusa/locking-redis',
        id: 'locking-redis',
        is_default: true,
        options: { redisUrl: process.env.REDIS_URL },
      }] },
    },
  ] : []), ...(process.env.STRIPE_TAX_TEST_ENABLED === 'true' ? [{
    resolve: '@medusajs/medusa/tax',
    options: { providers: [{ resolve: './src/modules/stripe-tax-test', id: 'stripe', options: { apiKey: process.env.STRIPE_API_KEY } }] },
  }] : []), {
    resolve: '@medusajs/medusa/notification',
    options: { providers: [{ resolve: './src/modules/resend', id: 'resend', options: { channels: ['email'] } }] },
  }, ...(stripeTestEnabled ? [{
    resolve: '@medusajs/medusa/payment',
    options: {
      providers: [{
        resolve: '@medusajs/medusa/payment-stripe',
        id: 'stripe',
        options: {
          apiKey: process.env.STRIPE_API_KEY,
          webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
          capture: true,
        },
      }],
    },
  }, {
    resolve: '@medusajs/medusa/fulfillment',
    options: { providers: [
      { resolve: '@medusajs/medusa/fulfillment-manual', id: 'manual' },
      { resolve: './src/modules/shippo-test', id: 'shippo' },
    ] },
  }] : [])],
  projectConfig: {
    ...(localHttpAdmin ? { cookieOptions: { secure: false, sameSite: 'lax' as const, httpOnly: true } } : {}),
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    }
  }
})
