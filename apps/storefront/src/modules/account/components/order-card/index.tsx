import { HttpTypes } from "@medusajs/types"
import Thumbnail from "@modules/products/components/thumbnail"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { convertToLocale } from "@lib/util/money"
import { customerOrderStatus } from "@lib/util/customer-order-status"
export default function OrderCard({ order }: { order: HttpTypes.StoreOrder }) {
  const status = customerOrderStatus(order)
  const count = order.items?.reduce((n, item) => n + item.quantity, 0) || 0
  return (
    <article className="rh-b-order-card" data-testid="order-card">
      <div className="rh-b-order-card-top">
        <div>
          <LocalizedClientLink
            href={`/account/orders/details/${order.id}`}
            className="rh-b-order-number"
          >
            #<span data-testid="order-display-id">{order.display_id}</span>
          </LocalizedClientLink>
          <time
            data-testid="order-created-at"
            dateTime={new Date(order.created_at).toISOString()}
          >
            {new Date(order.created_at).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </time>
        </div>
        <span className={`rh-b-status rh-b-status-${status.group}`}>
          {status.label}
        </span>
      </div>
      <div className="rh-b-order-card-bottom">
        <div className="rh-b-order-thumbs">
          {order.items?.slice(0, 3).map((item) => (
            <div key={item.id} data-testid="order-item">
              <Thumbnail thumbnail={item.thumbnail} size="square" />
              <span className="sr-only" data-testid="item-title">
                {item.title}
              </span>
            </div>
          ))}
          <span>
            {count} {count === 1 ? "piece" : "pieces"}
          </span>
        </div>
        <div className="rh-b-order-total">
          <small>Order total</small>
          <strong data-testid="order-amount">
            {convertToLocale({
              amount: order.total,
              currency_code: order.currency_code,
            })}
          </strong>
        </div>
        <LocalizedClientLink
          href={`/account/orders/details/${order.id}`}
          className="rh-b-order-link"
          data-testid="order-details-link"
        >
          View order →
        </LocalizedClientLink>
      </div>
    </article>
  )
}
