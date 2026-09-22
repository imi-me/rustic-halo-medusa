const { test } = require("node:test")
const assert = require("node:assert/strict")
const { readFileSync } = require("node:fs")
const { join } = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")

// Exercise the server action with its API, cookies, and Next navigation boundary
// replaced. The production TypeScript is compiled, rather than copied here.
const source = ts.transpileModule(
  readFileSync(join(__dirname, "../src/lib/data/cart.ts"), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }
).outputText

function loadAction({ cartId = "cart_test", apiError } = {}) {
  const updates = []
  const redirects = []
  const modules = {
    "@lib/config": {
      sdk: {
        store: {
          cart: {
            update: async (id, data) => {
              updates.push({ id, data })
              if (apiError) throw new Error(apiError)
              return { cart: { id } }
            },
          },
        },
      },
    },
    "@lib/util/medusa-error": {
      default: (error) => {
        throw error
      },
    },
    "next/cache": { revalidateTag: () => {} },
    "next/navigation": {
      redirect: (url) => {
        redirects.push(url)
      },
    },
    "./cookies": {
      getCartId: async () => cartId,
      getAuthHeaders: async () => ({}),
      getCacheTag: async (tag) => tag,
    },
    "./regions": {},
    "./locale-actions": {},
  }
  const context = {
    Error,
    exports: {},
    require: (name) => {
      assert.ok(Object.hasOwn(modules, name), `Unexpected dependency: ${name}`)
      return modules[name]
    },
  }
  vm.runInNewContext(source, context, { filename: "cart.js" })
  return { action: context.exports.setAddresses, updates, redirects }
}

function addressForm({ shared = false } = {}) {
  const form = new FormData()
  const address = {
    first_name: "Test",
    last_name: "Buyer",
    address_1: "1 Test Lane",
    postal_code: "10001",
    city: "New York",
    country_code: "us",
    province: "NY",
  }
  for (const [key, value] of Object.entries(address)) {
    form.set(`shipping_address.${key}`, value)
    form.set(
      `billing_address.${key}`,
      key === "address_1" ? "2 Billing Lane" : value
    )
  }
  form.set("email", "checkout@example.test")
  if (shared) form.set("same_as_billing", "on")
  return form
}

test("saves separate billing and shipping addresses with optional fields absent", async () => {
  const { action, updates, redirects } = loadAction()
  assert.equal(await action(null, addressForm()), undefined)
  assert.equal(updates.length, 1)
  assert.equal(updates[0].id, "cart_test")
  assert.equal(updates[0].data.shipping_address.address_1, "1 Test Lane")
  assert.equal(updates[0].data.billing_address.address_1, "2 Billing Lane")
  assert.equal(updates[0].data.billing_address.phone, "")
  assert.equal(updates[0].data.email, "checkout@example.test")
  assert.deepEqual(redirects, ["/us/checkout?step=delivery"])
})

test("uses the shipping address for billing when selected", async () => {
  const { action, updates } = loadAction()
  await action(null, addressForm({ shared: true }))
  assert.equal(
    updates[0].data.billing_address,
    updates[0].data.shipping_address
  )
})

test("waits for the cart cookie and rejects a missing cart before updating", async () => {
  const { action, updates, redirects } = loadAction({ cartId: null })
  assert.equal(
    await action(null, addressForm()),
    "No existing cart found when setting addresses"
  )
  assert.equal(updates.length, 0)
  assert.equal(redirects.length, 0)
})

for (const field of [
  "shipping_address.first_name",
  "billing_address.first_name",
  "email",
]) {
  test(`rejects uploaded files in ${field}`, async () => {
    const { action, updates, redirects } = loadAction()
    const form = addressForm()
    form.set(field, new Blob(["invalid"]), "invalid.txt")
    assert.equal(await action(null, form), `Invalid text field: ${field}`)
    assert.equal(updates.length, 0)
    assert.equal(redirects.length, 0)
  })
}

test("returns an API failure without advancing checkout", async () => {
  const { action, redirects } = loadAction({ apiError: "Address rejected" })
  assert.equal(await action(null, addressForm()), "Address rejected")
  assert.equal(redirects.length, 0)
})
