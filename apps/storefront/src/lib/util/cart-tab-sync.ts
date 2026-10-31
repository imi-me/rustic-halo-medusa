const CHANNEL = "rustic-halo-cart"
const STORAGE_KEY = "rh-cart-change"
const MESSAGE = "cart-changed"

/** Announce only that the cart changed; each tab fetches its own authorized cart. */
export function connectCartTabs(
  onChange: () => void,
  browser: Window & typeof globalThis = window
) {
  let channel: BroadcastChannel | undefined
  try {
    channel = new browser.BroadcastChannel(CHANNEL)
    channel.onmessage = (event) => {
      if (event.data?.type === MESSAGE) onChange()
    }
  } catch { /* Storage events still work when BroadcastChannel is unavailable. */ }

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY && event.newValue) onChange()
  }
  const onVisible = () => {
    if (browser.document.visibilityState === "visible") onChange()
  }
  // Reconcile when a suspended tab returns, even if it missed a notification.
  browser.addEventListener("storage", onStorage)
  browser.addEventListener("focus", onVisible)
  browser.addEventListener("pageshow", onVisible)
  browser.document.addEventListener("visibilitychange", onVisible)

  return {
    notify() {
      try {
        if (channel) {
          channel.postMessage({ type: MESSAGE })
          return
        }
      } catch { /* Fall back to storage if the channel was interrupted. */ }
      try {
        browser.localStorage.setItem(STORAGE_KEY, `${Date.now()}-${Math.random()}`)
      } catch { /* Focus/visibility recovery still works with storage disabled. */ }
    },
    dispose() {
      channel?.close()
      browser.removeEventListener("storage", onStorage)
      browser.removeEventListener("focus", onVisible)
      browser.removeEventListener("pageshow", onVisible)
      browser.document.removeEventListener("visibilitychange", onVisible)
    },
  }
}
