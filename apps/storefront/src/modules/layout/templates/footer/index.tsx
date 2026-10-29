import Image from "next/image"
import Preferences from "@modules/layout/components/preferences"
import { listLocales } from "@lib/data/locales"
import { getLocale } from "@lib/data/locale-actions"
import { listRegions } from "@lib/data/regions"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { listCategories } from "@lib/data/categories"
import { listCollections } from "@lib/data/collections"
import { brandCategoryHref } from "@lib/brand/category-links"
export default async function Footer() {
  const [categories, { collections }, regions, locales, locale] =
    await Promise.all([
      listCategories(),
      listCollections(),
      listRegions(),
      listLocales(),
      getLocale(),
    ])
  const hrefFor = (handle: string) =>
    brandCategoryHref(handle, categories, collections)
  return (
    <footer className="rh-b-footer">
      <div className="rh-b-footer-grid">
        <div className="rh-b-footer-brand">
          <LocalizedClientLink href="/" aria-label="Rustic Halo home">
            <Image
              src="/brand/rustic-halo-web-logo.png"
              alt="Rustic Halo"
              width={512}
              height={205}
            />
          </LocalizedClientLink>
          <p>
            Laser cut. Engraved. Handpainted.
            <br />
            Full of personality.
          </p>
        </div>
        <div>
          <h2>Shop</h2>
          <LocalizedClientLink href={hrefFor("hair-claws")}>
            Hair claws
          </LocalizedClientLink>
          <LocalizedClientLink href={hrefFor("earrings")}>
            Earrings
          </LocalizedClientLink>
          <LocalizedClientLink href={hrefFor("home-decor")}>
            Home &amp; décor
          </LocalizedClientLink>
          <LocalizedClientLink href="/store">All pieces</LocalizedClientLink>
        </div>
        <div>
          <h2>Customer care</h2>
          <LocalizedClientLink href="/customer-service">
            Contact &amp; care
          </LocalizedClientLink>
          <LocalizedClientLink href="/customer-service#returns">
            Shipping &amp; returns
          </LocalizedClientLink>
          <LocalizedClientLink href="/account">
            Your account
          </LocalizedClientLink>
          <a href="mailto:hello@rustichalo.com">hello@rustichalo.com</a>
        </div>
        <div>
          <h2>Follow along</h2>
          <a
            href="https://www.instagram.com/rustichalo/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Instagram ↗
          </a>
          <a
            href="https://www.facebook.com/rustichalo/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Facebook ↗
          </a>
        </div>
      </div>
      <Preferences
        regions={regions || []}
        locales={locales || []}
        locale={locale}
      />
      <div className="rh-b-footer-bottom">
        <span>© {new Date().getFullYear()} Rustic Halo</span>
        <div>
          <LocalizedClientLink href="/privacy">Privacy</LocalizedClientLink>
          <LocalizedClientLink href="/terms">Terms</LocalizedClientLink>
        </div>
      </div>
    </footer>
  )
}
