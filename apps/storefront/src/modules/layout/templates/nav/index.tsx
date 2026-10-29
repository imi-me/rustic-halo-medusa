import NavigationLinks from "@modules/layout/components/navigation-links"
import HeaderSearch from "@modules/layout/components/search"
import { Suspense } from "react"
import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import TopMenu from "@modules/layout/components/top-menu"
import { listCollections } from "@lib/data/collections"
import { listCategories } from "@lib/data/categories"
import BagIcon from "@modules/layout/components/bag-icon"

export default async function Nav() {
  const [{ collections }, categories] = await Promise.all([
    listCollections(),
    listCategories(),
  ])
  const links = [
    { name: "Shop all", href: "/store" },
    ...categories
      .filter((c) => !c.parent_category_id)
      .map((c) => ({ name: c.name, href: `/categories/${c.handle}` })),
    ...(categories.length
      ? []
      : collections
          .filter((c) => c.metadata?.grouping !== "theme")
          .map((c) => ({ name: c.title, href: `/collections/${c.handle}` }))),
    ...collections
      .filter((c) => c.metadata?.grouping === "theme")
      .slice(0, 2)
      .map((c) => ({ name: c.title, href: `/collections/${c.handle}` })),
    { name: "Our story", href: "/#our-story" },
  ]
  return (
    <div className="rh-header-shell sticky top-0 inset-x-0 z-50 group">
      <header className="rh-header">
        <div className="rh-navigation">
          <LocalizedClientLink
            href="/"
            className="rh-brand-lockup"
            data-testid="nav-store-link"
            aria-label="Rustic Halo home"
          >
            <Image
              src="/brand/rustic-halo-web-logo.png"
              alt="Rustic Halo"
              width={512}
              height={205}
              className="rh-web-logo"
              priority
            />
          </LocalizedClientLink>
          <HeaderSearch />
          <div className="rh-header-actions">
            <LocalizedClientLink
              href="/account"
              className="rh-b-account-link"
              aria-label="Your account"
            >
              <span>Account</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <circle cx="12" cy="8" r="3.5" />
                <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
              </svg>
            </LocalizedClientLink>
            <Suspense
              fallback={
                <LocalizedClientLink
                  className="rh-cart-link"
                  href="/cart"
                  data-testid="nav-cart-link"
                  aria-label="Shopping cart"
                >
                  <BagIcon />
                </LocalizedClientLink>
              }
            >
              <CartButton />
            </Suspense>
            <TopMenu
              links={[...links, { name: "Account", href: "/account" }]}
            />
          </div>
        </div>
        <nav className="rh-b-desktop-nav" aria-label="Main navigation">
          <NavigationLinks links={links} />
        </nav>
      </header>
    </div>
  )
}
