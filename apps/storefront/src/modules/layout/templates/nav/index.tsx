import HeaderSearch from "@modules/layout/components/search"
import { Suspense } from "react"
import Image from "next/image"
import { listLocales } from "@lib/data/locales"
import { getLocale } from "@lib/data/locale-actions"
import { listRegions } from "@lib/data/regions"
import { StoreRegion } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import SideMenu from "@modules/layout/components/side-menu"
import { listCollections } from "@lib/data/collections"
import { availableHomeCollections } from "@lib/brand/home-collections"

export default async function Nav() {
  const [regions, locales, currentLocale, collectionResult] = await Promise.all([
    listRegions().then((regions: StoreRegion[]) => regions),
    listLocales(),
    getLocale(),
    listCollections(),
  ])
  const shopCollections = availableHomeCollections(collectionResult.collections)
  const hairClaws = shopCollections.find((collection) => collection.label === "Hair Claws")
  const earrings = shopCollections.find((collection) => collection.label === "Earrings")
  const gifts = shopCollections.find((collection) => collection.label === "Gifts")
  const mobileLinks = [
    { name: "Shop", href: "/store" },
    ...shopCollections.map((collection) => ({ name: collection.label === "Gifts" ? "Home & Gifts" : collection.label, href: `/collections/${collection.handle}` })),
    { name: "Our Story", href: "/#our-story" },
    { name: "Account", href: "/account" },
    { name: "Cart", href: "/cart" },
  ]

  return (
    <div className="rh-header-shell sticky top-0 inset-x-0 z-50 group">
      <div className="rh-announcement">Made to order · Ships in 3–5 business days</div>
      <header className="rh-header">
        <nav className="rh-navigation" aria-label="Main navigation">
          <div className="rh-mobile-menu">
            <SideMenu regions={regions} locales={locales} currentLocale={currentLocale} links={mobileLinks} />
          </div>
          <LocalizedClientLink href="/" className="rh-brand-lockup rh-brand-with-caption" data-testid="nav-store-link" aria-label="Rustic Halo home">
            <Image src="/brand/rustic-halo-circle-horizontal.svg" alt="Rustic Halo" width={516} height={88} className="rh-horizontal-logo" priority /><span className="rh-logo-tagline">Makers of laser cut, engraved, and handpainted products.</span>
          </LocalizedClientLink>
          <div className="rh-desktop-links">
            <details className="rh-shop-dropdown"><summary>Shop</summary><div className="rh-shop-dropdown-panel">
              <LocalizedClientLink href="/store">Shop all</LocalizedClientLink>
              {shopCollections.map((collection) => <LocalizedClientLink href={`/collections/${collection.handle}`} key={collection.handle}>{collection.label}</LocalizedClientLink>)}
            </div></details>
            {hairClaws && <LocalizedClientLink href={`/collections/${hairClaws.handle}`}>Hair Claws</LocalizedClientLink>}
            {earrings && <LocalizedClientLink href={`/collections/${earrings.handle}`}>Earrings</LocalizedClientLink>}
            {gifts && <LocalizedClientLink href={`/collections/${gifts.handle}`}>Home &amp; Gifts</LocalizedClientLink>}
            <LocalizedClientLink href="/#our-story">Our Story</LocalizedClientLink>
          </div>
          <HeaderSearch />
          <div className="rh-header-actions">
            <LocalizedClientLink className="rh-account-link" href="/account" data-testid="nav-account-link">Account</LocalizedClientLink>
            <Suspense fallback={<LocalizedClientLink href="/cart" data-testid="nav-cart-link">Cart (0)</LocalizedClientLink>}>
              <CartButton />
            </Suspense>
          </div>
        </nav>
      </header>
    </div>
  )
}
