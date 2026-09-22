const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

// Run the production component handler, replacing React state and service
// boundaries. No Stripe, network, or order operation can occur in these tests.
const source = ts.transpileModule(readFileSync(join(__dirname,
  '../src/modules/checkout/components/payment-button/index.tsx'), 'utf8'), {
 compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText

function button(validate) {
 const calls = [], states = []
 let stateIndex = 0
 const react = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
  Fragment: 'fragment',
  useState: initial => {
   const index = stateIndex++
   states[index] = initial
   return [initial, value => { states[index] = value }]
  },
 }
 const modules = {
  react,
  '@lib/constants': { isStripeLike: () => true, isManual: () => false },
  '@lib/data/cart': {
   validateCheckoutTax: async () => { calls.push('validate'); await validate() },
   placeOrder: async () => { calls.push('order') },
  },
  '@modules/common/components/ui': { Button: 'button' },
  '@stripe/react-stripe-js': {
   useStripe: () => ({ confirmPayment: async () => {
    calls.push('payment'); return { error: { message: 'Stub: no payment attempted' } }
   } }),
   useElements: () => ({}),
  },
  'next/navigation': { useParams: () => ({ countryCode: 'us' }) },
  '../error-message': { default: 'error' },
 }
 const context = { exports: {}, Error, window: { location: { origin: 'http://localhost:18000' } },
  require: name => { assert.ok(Object.hasOwn(modules, name), name); return modules[name] } }
 vm.runInNewContext(source, context)
 const cart = { id: 'cart_test', shipping_address: {}, billing_address: {},
  email: 'staging-tax@example.com', shipping_methods: [{}],
  payment_collection: { payment_sessions: [{ provider_id: 'pp_stripe_stripe' }] } }
 const selected = context.exports.default({ cart, 'data-testid': 'payment' })
 const rendered = selected.type(selected.props)
 return { click: rendered.children[0].props.onClick, calls, states }
}

test('waits for tax validation before contacting Stripe', async () => {
 let release
 const validation = new Promise(resolve => { release = resolve })
 const b = button(() => validation)
 const pending = b.click()
 await Promise.resolve()
 assert.deepEqual(b.calls, ['validate'])
 assert.equal(b.states[0], true)
 release()
 await pending
 assert.deepEqual(b.calls, ['validate', 'payment'])
 assert.equal(b.states[0], false)
 assert.equal(b.states[1], 'Stub: no payment attempted')
})

for (const reason of ['Tax totals differ', 'Tax service unavailable']) {
 test(`blocks Stripe and order creation when validation fails: ${reason}`, async () => {
  const b = button(async () => { throw new Error(reason) })
  await b.click()
  assert.deepEqual(b.calls, ['validate'])
  assert.equal(b.states[0], false)
  assert.equal(b.states[1], reason)
 })
}
