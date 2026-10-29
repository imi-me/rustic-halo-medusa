"use client"
import { listOrders } from "@lib/data/orders"
import { useState } from "react"
import { HttpTypes } from "@medusajs/types"
import { customerOrderStatus } from "@lib/util/customer-order-status"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import OrderCard from "../order-card"
export default function OrderOverview({
  orders,
}: {
  orders: HttpTypes.StoreOrder[]
}) {
  const [loaded, setLoaded] = useState(orders)
  const [hasMore, setHasMore] = useState(orders.length === 10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const loadMore = async () => {
    setLoading(true)
    setError("")
    try {
      const next = await listOrders(10, loaded.length)
      setLoaded((current) => [
        ...current,
        ...next.filter(
          (order) => !current.some((existing) => existing.id === order.id)
        ),
      ])
      setHasMore(next.length === 10)
    } catch {
      setError("Could not load more orders. Please try again.")
    } finally {
      setLoading(false)
    }
  }
  const [filter, setFilter] = useState("all")
  const [query, setQuery] = useState("")
  if (!orders?.length)
    return (
      <div className="rh-b-panel rh-b-empty" data-testid="no-orders-container">
        <h2>Your order history starts here.</h2>
        <p>
          Your pieces and delivery details will appear here after your first
          order.
        </p>
        <LocalizedClientLink
          href="/store"
          className="rh-b-button"
          data-testid="continue-shopping-button"
        >
          Explore the collection ↗
        </LocalizedClientLink>
      </div>
    )
  const visible = loaded.filter(
    (order) =>
      (filter === "all" || customerOrderStatus(order).group === filter) &&
      `${order.display_id} ${order.items
        ?.map((item) => item.product_title || item.title)
        .join(" ")}`
        .toLowerCase()
        .includes(query.trim().toLowerCase())
  )
  return (
    <>
      <div className="rh-b-orders-toolbar">
        <div role="group" aria-label="Filter orders">
          {[
            { id: "all", label: "All orders" },
            { id: "active", label: "In progress" },
            { id: "delivered", label: "Delivered" },
            ...(loaded.some((o) => o.status === "canceled")
              ? [{ id: "canceled", label: "Canceled" }]
              : []),
          ].map((f) => (
            <button
              type="button"
              key={f.id}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search order number or piece"
          aria-label="Search orders"
        />
      </div>
      <p className="rh-product-count" aria-live="polite">
        {visible.length} {visible.length === 1 ? "order" : "orders"}
        {hasMore ? " in this view" : ""}
      </p>
      {visible.length ? (
        visible.map((order) => <OrderCard key={order.id} order={order} />)
      ) : (
        <div className="rh-b-panel rh-b-empty">
          <h2>No matching orders</h2>
          <p>Try another order number or piece.</p>
          <button
            className="rh-b-button"
            type="button"
            onClick={() => {
              setFilter("all")
              setQuery("")
            }}
          >
            Show all orders
          </button>
        </div>
      )}
      {hasMore && (
        <div className="rh-load-more">
          <button
            type="button"
            className="rh-b-button"
            disabled={loading}
            onClick={loadMore}
          >
            {loading ? "Loading orders…" : "Load more orders"}
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  )
}
