import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { customerOrderStatus } from "@lib/util/customer-order-status"
import OrderCard from "../order-card"
export default function Overview({
  customer,
  orders,
}: {
  customer: HttpTypes.StoreCustomer | null
  orders: HttpTypes.StoreOrder[] | null
}) {
  const address =
    customer?.addresses?.find((a) => a.is_default_shipping) ||
    customer?.addresses?.[0]
  const active =
    orders?.filter((order) => customerOrderStatus(order).group === "active")
      .length || 0
  return (
    <div data-testid="overview-page-wrapper">
      <div className="rh-b-account-heading">
        <h1 data-testid="welcome-message" data-value={customer?.first_name}>
          Good to see you
          {customer?.first_name ? `, ${customer.first_name}` : ""}.
        </h1>
        <p>
          Your little favorites, recent orders, and the details that make it
          yours.
        </p>
      </div>
      <div className="rh-b-account-stats">
        <LocalizedClientLink href="/account/orders">
          <span>Order history</span>
          <strong>
            {orders?.length || 0} <small>recent orders</small>
          </strong>
        </LocalizedClientLink>
        <LocalizedClientLink href="/account/orders">
          <span>A little something on its way</span>
          <strong>
            {active} <small>in progress</small>
          </strong>
        </LocalizedClientLink>
        <LocalizedClientLink href="/account/addresses">
          <span>Delivery details</span>
          <strong data-testid="addresses-count">
            {customer?.addresses?.length || 0} <small>saved addresses</small>
          </strong>
        </LocalizedClientLink>
      </div>
      <div className="rh-b-account-dashboard">
        <section>
          <div className="rh-b-section-heading">
            <h2>Your latest order</h2>
            <LocalizedClientLink href="/account/orders" className="rh-b-link">
              All orders ↗
            </LocalizedClientLink>
          </div>
          {orders?.length ? (
            <OrderCard order={orders[0]} />
          ) : (
            <div className="rh-b-panel rh-b-empty">
              <h3>Your first little find is waiting.</h3>
              <p>Your orders will appear here once you place an order.</p>
              <LocalizedClientLink href="/store" className="rh-b-button">
                Explore the collection ↗
              </LocalizedClientLink>
            </div>
          )}
        </section>
        <div className="rh-b-account-side">
          <section className="rh-b-panel rh-b-profile-card">
            <div className="rh-b-avatar">
              {customer?.first_name?.[0]}
              {customer?.last_name?.[0]}
            </div>
            <h2>
              {customer?.first_name} {customer?.last_name}
            </h2>
            <p data-testid="customer-email">{customer?.email}</p>
            <LocalizedClientLink href="/account/profile" className="rh-b-link">
              Manage account details ↗
            </LocalizedClientLink>
          </section>
          <section className="rh-b-panel">
            <h2>Delivery address</h2>
            {address ? (
              <p className="rh-b-address">
                {address.first_name} {address.last_name}
                <br />
                {address.address_1}
                <br />
                {address.city}, {address.province} {address.postal_code}
                <br />
                {address.country_code?.toUpperCase()}
              </p>
            ) : (
              <p>Add an address for your next little find.</p>
            )}
            <LocalizedClientLink
              href="/account/addresses"
              className="rh-b-link"
            >
              Manage addresses ↗
            </LocalizedClientLink>
          </section>
        </div>
      </div>
    </div>
  )
}
