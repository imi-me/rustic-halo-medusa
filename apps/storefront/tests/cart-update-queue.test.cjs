const { test } = require("node:test")
const assert = require("node:assert/strict")
const { readFileSync } = require("node:fs")
const vm = require("node:vm")
const ts = require("typescript")
const source = ts.transpileModule(readFileSync(require("node:path").join(__dirname, "../src/lib/util/cart-update-queue.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const context = { exports: {} }
vm.runInNewContext(source, context)
const { createCartUpdateQueue } = context.exports

test("an earlier slow cart read cannot overwrite a later confirmed add", async () => {
  const queue = createCartUpdateQueue()
  let release
  const slow = new Promise(resolve => { release = resolve })
  const displayed = []
  const read = queue(async () => { await slow; displayed.push(0) })
  const add = queue(async () => { displayed.push(1); return 1 })
  await Promise.resolve()
  assert.deepEqual(displayed, [])
  release()
  await read
  assert.equal(await add, 1)
  assert.deepEqual(displayed, [0, 1])
})

test("a rejected mutation leaves the confirmed count intact and allows the next change", async () => {
  const queue = createCartUpdateQueue()
  let displayed = 2
  await assert.rejects(queue(async () => { throw new Error("out of stock") }), /out of stock/)
  assert.equal(displayed, 2)
  await queue(async () => { displayed = 1 })
  assert.equal(displayed, 1)
})
