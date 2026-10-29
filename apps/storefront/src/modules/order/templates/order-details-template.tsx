"use client"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Help from "@modules/order/components/help"
import Items from "@modules/order/components/items"
import OrderDetails from "@modules/order/components/order-details"
import OrderSummary from "@modules/order/components/order-summary"
import ShippingDetails from "@modules/order/components/shipping-details"
import ReorderButton from "@modules/order/components/reorder-button"
import { customerOrderStatus } from "@lib/util/customer-order-status"
export default function OrderDetailsTemplate({
  order,
}: {
  order: HttpTypes.StoreOrder
}) {
  const status = customerOrderStatus(order)
  const step =
    status.group === "delivered" ? 3 : status.label === "On the way" ? 2 : 1
  return (
    <div className="rh-b-order-details">
      <div className="rh-b-page-heading">
        <div>
          <span className="rh-b-kicker">Your little finds</span>
          <h1>Order #{order.display_id}</h1>
          <p>
            Placed{" "}
            {new Date(order.created_at).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <LocalizedClientLink
          href="/account/orders"
          className="rh-b-link"
          data-testid="back-to-overview-button"
        >
          ← Order history
        </LocalizedClientLink>
      </div>
      <section className="rh-b-panel rh-b-order-progress-panel">
        <div>
          <h2>
            {status.group === "delivered"
              ? "A little happy, delivered."
              : status.label === "On the way"
              ? "Your little finds are on their way."
              : status.group === "canceled"
              ? "This order was canceled."
              : "A little care goes into every piece."}
          </h2>
          <span className={`rh-b-status rh-b-status-${status.group}`}>
            {status.label}
          </span>
        </div>
        {status.group !== "canceled" && (
          <ol className="rh-b-progress" aria-label="Order progress">
            {[
              "Order placed",
              "Preparing your pieces",
              "On the way",
              "Delivered",
            ].map((label, index) => (
              <li
                key={label}
                className={
                  index < step
                    ? "complete"
                    : index === step
                    ? "current"
                    : "pending"
                }
              >
                <span>{index < step ? "✓" : index + 1}</span>
                <strong>{label}</strong>
              </li>
            ))}
          </ol>
        )}
      </section>
      <div
        className="rh-b-order-detail-grid"
        data-testid="order-details-container"
      >
        <section className="rh-b-panel">
          <h2>Your pieces</h2>
          <Items order={order} />
          <ReorderButton items={order.items || []} />
          <LocalizedClientLink href="/store" className="rh-b-link">
            Explore the collection ↗
          </LocalizedClientLink>
        </section>
        <div className="rh-b-order-detail-side">
          <section className="rh-b-panel">
            <OrderSummary order={order} />
          </section>
          <section className="rh-b-panel">
            <ShippingDetails order={order} />
          </section>
        </div>
      </div>
      <section className="rh-b-panel rh-b-order-contact">
        <OrderDetails order={order} showStatus />
      </section>
      <Help />
    </div>
  )
}
