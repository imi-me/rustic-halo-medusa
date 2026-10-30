"use client"

import ItemsTemplate from "./items"
import Summary from "./summary"
import EmptyCartMessage from "../components/empty-cart-message"
import SignInPrompt from "../components/sign-in-prompt"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"
import { useCartSnapshot } from "@modules/cart/components/cart-state"
export default function CartTemplate({
  cart: serverCart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) {
  const cart = useCartSnapshot(serverCart)
  const count = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0
  return (
    <div
      className="content-container rh-b-cart-page"
      data-testid="cart-container"
    >
      <nav className="rh-breadcrumb" aria-label="Breadcrumb">
        <LocalizedClientLink href="/">Home</LocalizedClientLink>
        <span>/</span>
        <span>Your bag</span>
      </nav>
      {cart?.items?.length ? (
        <>
          <div className="rh-b-page-heading">
            <div>
              <span className="rh-b-kicker">A few little favorites</span>
              <h1>
                Your bag <span className="rh-b-count">{count}</span>
              </h1>
            </div>
            <LocalizedClientLink href="/store" className="rh-b-link">
              Continue exploring ↗
            </LocalizedClientLink>
          </div>
          <div className="rh-b-cart-grid">
            <div>
              <div className="rh-b-cart-items">
                <ItemsTemplate cart={cart} />
              </div>
              {!customer && (
                <div className="rh-b-cart-signin">
                  <SignInPrompt />
                </div>
              )}
              <div className="rh-b-cart-note">
                <h2>Good things, in the details.</h2>
                <p>
                  Engraved accessories and thoughtful gifts, full of
                  personality.
                </p>
              </div>
            </div>
            <aside className="rh-b-cart-summary">
              {cart.region && <Summary cart={cart} />}
            </aside>
          </div>
        </>
      ) : (
        <div className="rh-b-empty">
          <EmptyCartMessage />
        </div>
      )}
    </div>
  )
}
