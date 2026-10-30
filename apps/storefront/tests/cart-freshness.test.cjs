const { test } = require("node:test")
const assert = require("node:assert/strict")
const { readFileSync } = require("node:fs")
const { join } = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")

const source = ts.transpileModule(
  readFileSync(join(__dirname, "../src/lib/data/cart.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText

function loadCart({ cartId = "cart_current", apiError } = {}) {
  let quantity = 1
  const requests = []
  const mutations = []
  const events = []
  const cache = new Map()
  const confirmed = { id: cartId, items: [{ id: "line_current", variant_id: "variant_current", quantity: 2, metadata: { hair_claw_color: "Black" } }], total: 2800 }
  const mutate = method => async (...args) => {
    mutations.push({method, args})
    events.push("backend mutation")
    if (apiError) throw new Error(apiError)
    return method === "delete" ? { parent: confirmed } : { cart: confirmed }
  }
  const modules = {
    "@lib/config": { sdk: { store: { cart: {
      createLineItem: mutate("add"), updateLineItem: mutate("update"), deleteLineItem: mutate("delete"),
    } }, client: { fetch: async (url, options) => {
      requests.push({ url, options })
      if (options.cache === "force-cache" && cache.has(url)) return cache.get(url)
      const result = { cart: { id: url.split("/").pop(), region_id: "region_current", items: quantity ? [{ id: "line_current", quantity }] : [] } }
      if (options.cache === "force-cache") cache.set(url, result)
      return result
    } } } },
    "@lib/util/medusa-error": { default: error => { throw error } },
    "next/cache": { revalidateTag() {} },
    "next/navigation": {},
    "./cookies": {
      getCartId: async () => cartId,
      getAuthHeaders: async () => ({ authorization: "Bearer current-customer" }),
      getCacheOptions: async () => ({ tags: ["carts-session"] }),
      getCacheTag: async tag => `${tag}-session`,
    },
    "./regions": { getRegion: async () => ({ id: "region_current" }) },
    "./locale-actions": {},
  }
  const context = { exports: {}, require: name => {
    assert.ok(Object.hasOwn(modules, name), `Unexpected dependency: ${name}`)
    return modules[name]
  } }
  vm.runInNewContext(source, context, { filename: "cart.js" })
  return { read: context.exports.retrieveCart, actions: context.exports, requests, mutations, confirmed, events, setQuantity: value => { quantity = value } }
}

test("cart reads reflect additions, increases, decreases, and last-item removal", async () => {
  const cart = loadCart()
  for (const quantity of [1, 2, 1, 0, 3]) {
    cart.setQuantity(quantity)
    const result = await cart.read()
    assert.equal(result.items.reduce((sum, item) => sum + item.quantity, 0), quantity)
  }
})

test("fresh reads retain the explicit cart, requested fields, and customer authorization", async () => {
  const cart = loadCart()
  const result = await cart.read("cart_explicit", "id,*items")
  assert.equal(result.id, "cart_explicit")
  assert.equal(cart.requests[0].options.query.fields, "id,*items")
  assert.equal(cart.requests[0].options.headers.authorization, "Bearer current-customer")
})

test("a visitor without a cart does not fetch another cart", async () => {
  // null avoids the default option while representing the absent cookie.
  const missing = loadCart({ cartId: null })
  assert.equal(await missing.read(), null)
  assert.equal(missing.requests.length, 0)
})

const mutations = {
  addToCart: action => action({ variantId: "variant_current", quantity: 1, countryCode: "us" }),
  updateLineItem: action => action({ lineId: "line_current", quantity: 2 }),
  deleteLineItem: action => action("line_current"),
}

for (const [name, invoke] of Object.entries(mutations)) {
  test(`${name} returns the confirmed cart with line identity, choices, and totals`, async () => {
    const cart = loadCart()
    const result = await invoke(cart.actions[name])
    assert.equal(result, cart.confirmed)
    const args = cart.mutations[0].args
    assert.equal(args[0], "cart_current")
    assert.match(args.at(-2).fields, /items.metadata/)
    assert.equal(args.at(-1).authorization, "Bearer current-customer")
  })
  test(`${name} rejects instead of returning an invented cart when the backend fails`, async () => {
    const cart = loadCart({ apiError: "change rejected" })
    await assert.rejects(invoke(cart.actions[name]), /change rejected/)
  })
}
