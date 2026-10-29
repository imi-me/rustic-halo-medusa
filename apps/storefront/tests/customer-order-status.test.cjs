const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const vm = require("node:vm")
const ts = require("typescript")
const path = require("node:path")
const source = fs.readFileSync(
  path.join(__dirname, "../src/lib/util/customer-order-status.ts"),
  "utf8"
)
const context = { exports: {} }
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  context
)
const status = context.exports.customerOrderStatus

test("canceled orders never appear in the active or delivered filter, regardless of fulfillment", () => {
  for (const fulfillment_status of ["not_fulfilled", "shipped", "delivered"])
    assert.equal(
      status({ status: "canceled", fulfillment_status }).group,
      "canceled"
    )
})
test("partial fulfillment and shipping remain active until delivery is confirmed", () => {
  for (const fulfillment_status of [
    "not_fulfilled",
    "partially_fulfilled",
    "fulfilled",
    "partially_shipped",
    "partially_delivered",
    "shipped",
  ])
    assert.equal(
      status({ status: "pending", fulfillment_status }).group,
      "active"
    )
  assert.equal(
    status({ status: "completed", fulfillment_status: "delivered" }).group,
    "delivered"
  )
})
