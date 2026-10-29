const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs"),
  vm = require("node:vm"),
  ts = require("typescript"),
  path = require("node:path")
const c = { exports: {} }
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(
      path.join(__dirname, "../src/lib/util/navigation-active.ts"),
      "utf8"
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }
  ).outputText,
  c
)
const active = c.exports.navigationIsActive

test("Shop all is active only on the store route, never on home or collections", () => {
  assert.equal(active("/store", "/us/store", "us"), true)
  assert.equal(active("/store", "/us/store/", "us"), true)
  for (const page of [
    "/us",
    "/us/collections/novelty-signs",
    "/us/categories/hair-claws",
    "/us/products/boho-gecko-hair-claw",
    "/us/cart",
  ])
    assert.equal(active("/store", page, "us"), false)
})
test("collection/category selection respects route boundaries and storefront country", () => {
  assert.equal(
    active("/collections/novelty-signs", "/us/collections/novelty-signs", "us"),
    true
  )
  assert.equal(
    active("/collections/earrings", "/us/collections/earrings-studs", "us"),
    false
  )
  assert.equal(
    active("/categories/home", "/ca/categories/home/signs", "ca"),
    true
  )
  assert.equal(active("/account", "/us/account/orders", "us"), true)
})
test("Our story is active only at its home-page anchor", () => {
  assert.equal(active("/#our-story", "/us", "us", "#our-story"), true)
  assert.equal(active("/#our-story", "/us", "us", ""), false)
  assert.equal(active("/#our-story", "/us/store", "us", "#our-story"), false)
})
