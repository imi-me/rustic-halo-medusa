import React from "react"
import AccountNav from "../components/account-nav"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
const AccountLayout = ({
  customer,
  children,
}: {
  customer: HttpTypes.StoreCustomer | null
  children: React.ReactNode
}) => (
  <div
    className="rh-b-account-page content-container"
    data-testid="account-page"
  >
    <nav className="rh-breadcrumb" aria-label="Breadcrumb">
      <LocalizedClientLink href="/">Home</LocalizedClientLink>
      <span>/</span>
      <LocalizedClientLink href="/account">Your account</LocalizedClientLink>
    </nav>
    {customer && <AccountNav customer={customer} />}
    <div className="rh-b-account-content">{children}</div>
    <section className="rh-b-account-help">
      <div>
        <h2>A question about a piece?</h2>
        <p>We’re here to help with the little details.</p>
      </div>
      <LocalizedClientLink href="/customer-service">
        Contact &amp; care ↗
      </LocalizedClientLink>
    </section>
  </div>
)
export default AccountLayout
