import { isProductSoldOut } from "@lib/util/product-availability"
import { HttpTypes } from "@medusajs/types"
import { getProductPrice } from "@lib/util/get-product-price"
import Image from "next/image"
import { brandAssets, brandCollections, brandPicks } from "@lib/brand/assets"

const details = [
  { title: "Inspired by nature", subtitle: "Woodland details", path: "M20 4C10 3 3 8 5 15c7 3 14-2 15-11ZM4 21 15 10" },
  { title: "Full of personality", subtitle: "Find your kind of lovely", path: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" },
  { title: "Thoughtful gifts", subtitle: "Little things, big meaning", path: "M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z" },
  { title: "Made to order", subtitle: "Ships in 3–5 business days", path: "M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-3 2 2-6A8.5 8.5 0 1 1 21 11.5ZM7 11h.01M12 11h.01M17 11h.01" },
]

export default function Hero({ countryCode, products }: { countryCode: string; products: HttpTypes.StoreProduct[] }) {
  const localHandles = new Set(products.map(p => p.handle))
  const localCollections = new Set(products.map(p => p.collection?.handle).filter(Boolean))
  const localHref = (href: string) => {
    const path = new URL(href).pathname
    const handle = path.split("/").pop() || ""
    if (path === "/collections/all") return `/${countryCode}/store`
    return (path.startsWith("/products/") ? localHandles.has(handle) : localCollections.has(handle)) ? `/${countryCode}${path}` : href
  }
  const picks = brandPicks.map(p => {
    const local = products.find(product => p.href.endsWith(`/products/${product.handle}`))
    return { ...p, soldOut: local ? isProductSoldOut(local) : false, name: local?.title || p.name, href: localHref(p.href), price: local ? `${new Set(local.variants?.map(v => v.calculated_price?.calculated_amount)).size > 1 ? "From " : ""}${getProductPrice({ product: local }).cheapestPrice?.calculated_price || ""}` : undefined }
  })
  return (
    <div className="rh-home rh-editorial-home">
      <section className="rh-wide-hero" aria-labelledby="home-heading">
        <Image src={brandCollections[1].image} alt="Rustic Halo engraved wooden hair claws in a woodland setting" fill priority sizes="100vw" />
        <div className="rh-wide-hero-shade" />
        <div className="rh-wide-hero-copy">
          <p className="rh-eyebrow">Small details. Big meaning.</p>
          <h1 id="home-heading">Everyday Accessories<br />with a Personal Touch</h1>
          <p>Nature-inspired accessories and thoughtful details, uniquely yours.</p>
          <div className="rh-hero-buttons"><a href="#collections" className="rh-button">Shop the collections <span aria-hidden="true">→</span></a><a href="#our-story" className="rh-button rh-button-outline">Our story <span aria-hidden="true">→</span></a></div>
        </div>
      </section>
      <div className="rh-detail-strip">
        {details.map(({ title, subtitle, path }) => <div key={title}><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg><p><strong>{title}</strong><small>{subtitle}</small></p></div>)}
      </div>
      <section id="collections" className="rh-compact-collections" aria-label="Browse collections">
        {[brandCollections[1], brandCollections[0], brandCollections[2], { name: "Gifts & more", image: brandPicks[4].image, alt: "Rustic Halo wooden goat door hanger", href: "https://rustichalo.com/collections/all" }].map(collection => <a href={localHref(collection.href)} key={collection.name} target={localHref(collection.href).startsWith("/") ? undefined : "_blank"} rel="noreferrer" className="rh-category-tile" aria-label={collection.name}><div><Image src={collection.image} alt={collection.alt} fill sizes="(max-width:760px) 35vw, 12vw" /></div><span><h2>{collection.name}</h2><small>Shop now →</small></span></a>)}
      </section>
      <section className="rh-picks" aria-labelledby="picks-heading">
        <div className="rh-picks-heading"><h2 id="picks-heading">A few favorites</h2><a href={`/${countryCode}/store`}>Shop all →</a></div>
        <div className="rh-picks-grid">{[...picks, { price: undefined, soldOut: false, name: "Explore hair claws & clips", image: brandCollections[1].image, href: localHref(brandCollections[1].href) }].map(product => <a className="rh-pick" key={product.name} href={product.href} target={product.href.startsWith("/") ? undefined : "_blank"} rel="noreferrer" aria-label={`${product.name}${product.soldOut ? " — Sold out" : ""}`}><div><Image src={product.image} alt={product.name} fill sizes="(max-width:760px) 45vw, 16vw" />{product.soldOut && <span className="rh-stock-badge">Sold out</span>}</div><h3>{product.name}</h3><span>{product.price || (product.href.startsWith("/") ? "Explore collection →" : "View in current shop ↗")}</span></a>)}</div>
      </section>
      <section id="our-story" className="rh-editorial-panels" aria-label="The Rustic Halo spirit">
        <article className="rh-photo-panel">
          <Image src={brandCollections[1].image} alt="" fill sizes="(max-width:760px) 100vw, 33vw" />
          <div className="rh-panel-copy"><p className="rh-eyebrow">Uniquely you</p><h2>Find your little detail.</h2><p>A favorite flower. A woodland shape. Something that makes you smile.</p><a href="#collections">Find your favorite <span aria-hidden="true">→</span></a></div>
        </article>
        <article className="rh-photo-panel">
          <Image src={brandCollections[0].image} alt="" fill sizes="(max-width:760px) 100vw, 33vw" />
          <div className="rh-panel-copy"><p className="rh-eyebrow">Give a little joy</p><h2>Thoughtful by nature.</h2><p>For someone special, or a well-deserved something for yourself.</p><a href={`/${countryCode}/store`}>Explore the shop <span aria-hidden="true">↗</span></a></div>
        </article>
        <article className="rh-photo-panel">
          <Image src={brandAssets.hero} alt="" fill sizes="(max-width:760px) 100vw, 33vw" />
          <div className="rh-panel-copy"><p className="rh-eyebrow">The Rustic Halo spirit</p><h2>Rooted in the little things.</h2><p>Wood grain, leafy shapes, and plenty of personality. That’s our kind of lovely.</p><a href="mailto:contact@rustichalo.com">Say hello <span aria-hidden="true">→</span></a></div>
        </article>
      </section>
    </div>
  )
}
