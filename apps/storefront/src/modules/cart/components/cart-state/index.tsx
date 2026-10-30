"use client"

import { retrieveCart } from "@lib/data/cart"
import { createCartUpdateQueue } from "@lib/util/cart-update-queue"
import { HttpTypes } from "@medusajs/types"
import { usePathname, useRouter } from "next/navigation"
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react"

type Cart = HttpTypes.StoreCart
type CartChange = () => Promise<Cart>
type CartState = { cart: Cart | null; mutate: (change: CartChange) => Promise<Cart> }
const CartContext = createContext<CartState | null>(null)

export function CartStateProvider({ initialCart, children }: {
  initialCart: Cart | null
  children: ReactNode
}) {
  const [cart, setCart] = useState(initialCart)
  const queue = useRef(createCartUpdateQueue())
  const pathname = usePathname()
  const router = useRouter()

  const mutate = useCallback((change: CartChange) => queue.current(async () => {
    const confirmed = await change()
    setCart(confirmed)
    router.refresh()
    return confirmed
  }), [router])

  useEffect(() => {
    // Re-read the active cart rather than applying an older layout snapshot.
    // This shares the mutation queue, so a navigation read cannot undo an add.
    let active = true
    queue.current(async () => {
      const confirmed = await retrieveCart()
      if (active) setCart(confirmed)
    }).catch(() => {})
    return () => { active = false }
  }, [initialCart, pathname])

  return <CartContext.Provider value={{ cart, mutate }}>{children}</CartContext.Provider>
}

export function useCartSnapshot(fallback: Cart | null) {
  const state = useContext(CartContext)
  return state ? state.cart : fallback
}

export function useCartMutation() {
  const state = useContext(CartContext)
  const router = useRouter()
  return async (change: CartChange) => {
    if (state) return state.mutate(change)
    const confirmed = await change()
    router.refresh()
    return confirmed
  }
}
