const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs"),
  vm = require("node:vm"),
  ts = require("typescript"),
  path = require("node:path")
const context = { exports: {} }
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(
      path.join(__dirname, "../src/lib/util/reorder-items.ts"),
      "utf8"
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }
  ).outputText,
  context
)
const { reorderItems } = context.exports

test("reorder retains exact variants and quantities and resumes after a rejected line", async () => {
  const lines = [
    { variantId: "variant-4-inch-rose", quantity: 2 },
    { variantId: "variant-leaf-red", quantity: 1 },
    { variantId: "variant-sign", quantity: 1 },
  ]
  const added = []
  let next = 0
  await assert.rejects(
    reorderItems(
      lines,
      0,
      async (line) => {
        if (line.variantId === "variant-leaf-red") throw Error("out of stock")
        added.push(line)
      },
      (n) => {
        next = n
      }
    ),
    /out of stock/
  )
  assert.equal(next, 1)
  assert.deepEqual(added, [lines[0]])
  await reorderItems(
    lines,
    next,
    async (line) => {
      added.push(line)
    },
    (n) => {
      next = n
    }
  )
  assert.equal(next, 3)
  assert.deepEqual(added, lines)
})
