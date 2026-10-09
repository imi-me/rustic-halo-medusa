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
import { homeCollectionTiles } from "@lib/brand/home-collections"
import BagIcon from "@modules/layout/components/bag-icon"

export default async function Nav() {
  const [regions, locales, currentLocale, collectionResult] = await Promise.all([
    listRegions().then((regions: StoreRegion[]) => regions),
    listLocales(),
    getLocale(),
    listCollections(),
  ])
  const shopCollections = collectionResult.collections.filter((collection) => collection.handle !== "best-sellers")
  const mobileLinks = [
    { name: "Shop", href: "/store" },
    ...shopCollections.map((collection) => ({ name: homeCollectionTiles.find((tile) => tile.handle === collection.handle)?.label || collection.title, href: `/collections/${collection.handle}` })),
    { name: "Our Story", href: "/#our-story" },
    { name: "Account", href: "/account" },
    { name: "Cart", href: "/cart" },
  ]

  return (
    <div className="rh-header-shell sticky top-0 inset-x-0 z-50 group">
      <header className="rh-header">
        <nav className="rh-navigation" aria-label="Main navigation">
          <LocalizedClientLink href="/" className="rh-brand-lockup" data-testid="nav-store-link" aria-label="Rustic Halo home">
            <Image src="/brand/rustic-halo-web-logo.png" alt="Rustic Halo" width={512} height={205} className="rh-web-logo" priority />
          </LocalizedClientLink>
          <div className="rh-mobile-menu">
            <SideMenu regions={regions} locales={locales} currentLocale={currentLocale} links={mobileLinks} />
          </div>
          <HeaderSearch />
          <div className="rh-header-actions">
            <Suspense fallback={<LocalizedClientLink className="rh-cart-link" href="/cart" data-testid="nav-cart-link" aria-label="Shopping cart"><BagIcon /></LocalizedClientLink>}>
              <CartButton />
            </Suspense>
          </div>
        </nav>
      </header>
    </div>
  )
}
