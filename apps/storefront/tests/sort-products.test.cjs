const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")

const context = { exports: {} }
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src/lib/util/sort-products.ts"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }
  ).outputText,
  context
)
const { sortProducts } = context.exports
const products = [
  { id: "3", title: "Zebra", created_at: "2026-10-29" },
  { id: "1", title: "apple 10", created_at: "2026-10-30" },
  { id: "2", title: "Apple 2", created_at: "2026-10-28" },
]
const ids = (sort) => Array.from(sortProducts(products, sort), (p) => p.id)

test("name sorting handles case and numbered names in both directions", () => {
  assert.deepEqual(ids("title_asc"), ["2", "1", "3"])
  assert.deepEqual(ids("title_desc"), ["3", "1", "2"])
  assert.deepEqual(products.map((p) => p.id), ["3", "1", "2"])
})

test("latest arrivals and retired price links sort newest first", () => {
  for (const sort of ["created_at", "price_asc", "price_desc", "unknown"])
    assert.deepEqual(ids(sort), ["1", "3", "2"])
})
