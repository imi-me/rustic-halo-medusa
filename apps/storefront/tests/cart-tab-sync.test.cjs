const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const source = ts.transpileModule(readFileSync(join(__dirname, '../src/lib/util/cart-tab-sync.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const context = { exports: {} }
vm.runInNewContext(source, context)
const { connectCartTabs } = context.exports

class Target {
  listeners = new Map()
  addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(listener) }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener) }
  emit(type, event = {}) { for (const listener of this.listeners.get(type) || []) listener(event) }
}
function tabs() {
  const windows = [], channels = new Set(), messages = []
  const create = ({ broadcast = true, storage = true } = {}) => {
    const browser = new Target()
    browser.document = Object.assign(new Target(), { visibilityState: 'visible' })
    browser.localStorage = { setItem(key, newValue) {
      if (!storage) throw new Error('storage unavailable')
      for (const peer of windows) if (peer !== browser) peer.emit('storage', { key, newValue })
    } }
    if (broadcast) browser.BroadcastChannel = class {
      constructor(name) { this.name = name; channels.add(this) }
      postMessage(data) { messages.push(data); for (const peer of channels) if (peer !== this && peer.name === this.name) peer.onmessage?.({ data }) }
      close() { channels.delete(this) }
    }
    windows.push(browser)
    return browser
  }
  return { create, messages }
}

test('confirmed changes notify other tabs without broadcasting cart/customer data or echoing', () => {
  const env = tabs(); let a = 0, b = 0
  const first = connectCartTabs(() => a++, env.create())
  const second = connectCartTabs(() => b++, env.create())
  first.notify(); assert.equal(a, 0); assert.equal(b, 1)
  second.notify(); assert.equal(a, 1); assert.equal(b, 1)
  assert.deepEqual(Object.keys(env.messages[0]), ['type'])
  first.dispose(); second.dispose()
})

test('storage fallback reaches both older and BroadcastChannel-capable tabs', () => {
  const env = tabs(); let changes = 0
  const first = connectCartTabs(() => {}, env.create({ broadcast: false }))
  const second = connectCartTabs(() => changes++, env.create())
  first.notify(); first.notify(); assert.equal(changes, 2)
  first.dispose(); second.dispose()
})

test('tabs with no messaging/storage recover when visible, focused or restored', () => {
  const env = tabs(), browser = env.create({ broadcast: false, storage: false }); let reads = 0
  const sync = connectCartTabs(() => reads++, browser)
  assert.doesNotThrow(() => sync.notify())
  browser.document.visibilityState = 'hidden'
  browser.document.emit('visibilitychange'); assert.equal(reads, 0)
  browser.document.visibilityState = 'visible'
  browser.document.emit('visibilitychange'); browser.emit('focus'); browser.emit('pageshow')
  assert.equal(reads, 3); sync.dispose()
})

test('unrelated storage changes never trigger cart reads', () => {
  const env = tabs(), browser = env.create(); let reads = 0
  const sync = connectCartTabs(() => reads++, browser)
  browser.emit('storage', { key: 'unrelated', newValue: '1' })
  browser.emit('storage', { key: 'rh-cart-change', newValue: null })
  assert.equal(reads, 0); sync.dispose()
})

test('unmounted providers close channels and remove all wake-up listeners', () => {
  const env = tabs(), browser = env.create(); let reads = 0
  const removed = connectCartTabs(() => reads++, browser)
  const sender = connectCartTabs(() => {}, env.create())
  removed.dispose(); sender.notify()
  browser.emit('storage', { key: 'rh-cart-change', newValue: '2' })
  browser.emit('focus'); browser.emit('pageshow'); browser.document.emit('visibilitychange')
  assert.equal(reads, 0); sender.dispose()
})

test('an add then removal causes peers to read the current cart rather than a supplied count', () => {
  const env = tabs(); let serverQuantity = 0, otherQuantity = 0
  const sender = connectCartTabs(() => {}, env.create())
  const receiver = connectCartTabs(() => { otherQuantity = serverQuantity }, env.create())
  serverQuantity = 2; sender.notify(); assert.equal(otherQuantity, 2)
  serverQuantity = 1; sender.notify(); assert.equal(otherQuantity, 1)
  serverQuantity = 0; sender.notify(); assert.equal(otherQuantity, 0)
  sender.dispose(); receiver.dispose()
})
