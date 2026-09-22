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

export default async function Nav() {
  const [regions, locales, currentLocale] = await Promise.all([
    listRegions().then((regions: StoreRegion[]) => regions),
    listLocales(),
    getLocale(),
  ])

  return (
    <div className="rh-header-shell sticky top-0 inset-x-0 z-50 group">
      <div className="rh-announcement"><span>Made to order · Ships in 3–5 business days</span><a href="mailto:contact@rustichalo.com">Contact</a></div>
      <header className="rh-header">
        <nav className="rh-navigation" aria-label="Main navigation">
          <div className="rh-mobile-menu">
            <SideMenu regions={regions} locales={locales} currentLocale={currentLocale} />
          </div>
          <LocalizedClientLink href="/" className="rh-brand-lockup rh-brand-with-caption" data-testid="nav-store-link" aria-label="Rustic Halo home">
            <Image src="/brand/rustic-halo-circle-horizontal.svg" alt="Rustic Halo" width={516} height={88} className="rh-horizontal-logo" priority /><span className="rh-logo-tagline">Nature inspired. Uniquely you.</span>
          </LocalizedClientLink>
          <div className="rh-desktop-links">
            <LocalizedClientLink href="/store">Shop all</LocalizedClientLink>
            <LocalizedClientLink href="/#collections">Collections</LocalizedClientLink>
            <LocalizedClientLink href="/#our-story">Our story</LocalizedClientLink>
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
