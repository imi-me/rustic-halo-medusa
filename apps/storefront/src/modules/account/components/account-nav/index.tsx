"use client"
import { useParams, usePathname } from "next/navigation"
import { signout } from "@lib/data/customer"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
export default function AccountNav({
  customer,
}: {
  customer: HttpTypes.StoreCustomer | null
}) {
  const path = usePathname()
  const { countryCode } = useParams<{ countryCode: string }>()
  const links = [
    { label: "Overview", href: "/account", test: "overview-link" },
    { label: "Order history", href: "/account/orders", test: "orders-link" },
    {
      label: "Account details",
      href: "/account/profile",
      test: "profile-link",
    },
    { label: "Addresses", href: "/account/addresses", test: "addresses-link" },
  ]
  return (
    <div className="rh-b-account-nav">
      <div className="rh-b-account-greeting">
        <span className="rh-b-kicker">Your Rustic Halo</span>
        <span>{customer?.email}</span>
      </div>
      <nav aria-label="Account navigation" data-testid="account-nav">
        {links.map((link) => {
          const full = `/${countryCode}${link.href}`
          const active =
            link.href === "/account" ? path === full : path?.startsWith(full)
          return (
            <LocalizedClientLink
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              data-testid={link.test}
            >
              {link.label}
            </LocalizedClientLink>
          )
        })}
        <button
          type="button"
          onClick={() => signout(countryCode)}
          data-testid="logout-button"
        >
          Sign out
        </button>
      </nav>
    </div>
  )
}
