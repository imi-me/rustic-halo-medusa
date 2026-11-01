import { HttpTypes } from "@medusajs/types"
import type { CSSProperties } from "react"
import type { HomepageContent } from "@lib/brand/homepage-content"
import { listProducts } from "@lib/data/products"
import { listCategories } from "@lib/data/categories"
import { brandCategoryHref } from "@lib/brand/category-links"
import { getHomepageContent } from "@lib/data/homepage-content"
import { storefrontDesign } from "@lib/brand/storefront-design"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductCard from "@modules/products/components/product-card"

function collectionStyle(
  c: HomepageContent["explore"]["items"][number],
): CSSProperties {
  const color =
    c.textColor === "light"
      ? "#ffffff"
      : c.textColor === "dark"
        ? "#292932"
        : c.textColor === "custom" &&
            /^#[0-9a-fA-F]{6}$/.test(c.customTextColor)
          ? c.customTextColor
          : undefined
  const type = {
    small: [25, 13, 22, 12],
    standard: [29, 14, 26, 12],
    large: [36, 16, 32, 14],
  }[c.textSize] || [29, 14, 26, 12]
  return {
    "--rh-c-color": color,
    "--rh-c-title": `${type[0]}px`,
    "--rh-c-body": `${type[1]}px`,
    "--rh-c-phone-title": `${type[2]}px`,
    "--rh-c-phone-body": `${type[3]}px`,
    "--rh-c-text-align":
      c.textAlignment === "center" || c.textAlignment === "right"
        ? c.textAlignment
        : "left",
    "--rh-c-items":
      c.textAlignment === "center"
        ? "center"
        : c.textAlignment === "right"
          ? "flex-end"
          : "flex-start",
    "--rh-c-alpha": Number.isFinite(c.textBoxOpacity)
      ? Math.max(0, Math.min(100, c.textBoxOpacity)) / 100
      : 1,
    "--rh-c-width":
      { compact: "320px", standard: "380px", wide: "520px" }[c.textBoxSize] ||
      "380px",
    "--rh-c-padding": c.textBoxSize === "compact" ? "24px" : "32px",
    "--rh-c-start":
      c.textBoxPosition === "center" || c.textBoxPosition === "right"
        ? "auto"
        : "28px",
    "--rh-c-end": c.textBoxPosition === "right" ? "28px" : "auto",
    "--rh-c-align":
      c.textBoxVerticalPosition === "top"
        ? "flex-start"
        : c.textBoxVerticalPosition === "bottom"
          ? "flex-end"
          : "center",
  } as CSSProperties
}

export default async function Hero({
  countryCode,
  collections,
}: {
  countryCode: string
  collections: HttpTypes.StoreCollection[]
}) {
  const { featured } = storefrontDesign
  const { hero: campaign, explore, seo } = await getHomepageContent()
  const textColor =
    campaign.textColor === "light"
      ? "#ffffff"
      : campaign.textColor === "dark"
        ? "#292932"
        : campaign.textColor === "custom" &&
            /^#[0-9a-fA-F]{6}$/.test(campaign.customTextColor)
          ? campaign.customTextColor
          : undefined
  const text = {
    small: { title: 36, body: 13, phoneTitle: 30, phoneBody: 12 },
    standard: { title: 43, body: 14, phoneTitle: 34, phoneBody: 12 },
    large: { title: 52, body: 16, phoneTitle: 40, phoneBody: 14 },
  }[campaign.textSize] || { title: 43, body: 14, phoneTitle: 34, phoneBody: 12 }
  const box = {
    compact: { width: 320, padding: 24 },
    standard: { width: 380, padding: 32 },
    wide: { width: 520, padding: 32 },
  }[campaign.textBoxSize] || { width: 380, padding: 32 }
  const boxOpacity = Number.isFinite(campaign.textBoxOpacity)
    ? Math.max(0, Math.min(100, campaign.textBoxOpacity))
    : 93
  const productCategories = await listCategories()
  const hrefFor = (href: string) => {
    if (!href.startsWith("/categories/")) return href
    const url = new URL(href, "https://rustic-halo.invalid")
    return (
      brandCategoryHref(
        url.pathname.split("/").pop()!,
        productCategories,
        collections,
      ) +
      url.search +
      url.hash
    )
  }
  let {
    response: { products },
  } = await listProducts({
    countryCode,
    queryParams: { handle: featured.handles, limit: 4 },
  })
  const hasFeaturedEdit = products.length > 0
  if (!products.length)
    ({
      response: { products },
    } = await listProducts({ countryCode, queryParams: { limit: 4 } }))
  const themes = collections.filter((c) => c.metadata?.grouping === "theme")
  return (
    <div className="rh-b-home">
      {campaign.enabled ? (
        <section
          className={`rh-b-hero${
            campaign.showText ? "" : " rh-b-hero-image-only"
          }`}
          aria-labelledby="home-heading"
        >
          {campaign.showText ? (
            <>
              <picture className="rh-b-hero-photo">
                <source
                  media="(max-width: 760px)"
                  srcSet={campaign.mobileImage}
                />
                <img
                  src={campaign.desktopImage}
                  alt={campaign.imageAlt}
                  width={2400}
                  height={800}
                  fetchPriority="high"
                  style={{ objectFit: campaign.imageFit }}
                />
              </picture>
              <div
                className="rh-b-hero-copy"
                data-box-clear={boxOpacity === 0 ? "true" : undefined}
                style={
                  {
                    "--rh-hero-text-alignment":
                      campaign.textAlignment === "center" ||
                      campaign.textAlignment === "right"
                        ? campaign.textAlignment
                        : "left",
                    "--rh-hero-box-align":
                      campaign.textBoxVerticalPosition === "top"
                        ? "flex-start"
                        : campaign.textBoxVerticalPosition === "bottom"
                          ? "flex-end"
                          : "center",
                    "--rh-hero-box-start":
                      campaign.textBoxPosition === "center" ||
                      campaign.textBoxPosition === "right"
                        ? "auto"
                        : "45px",
                    "--rh-hero-box-end":
                      campaign.textBoxPosition === "right" ? "45px" : "auto",
                    "--rh-hero-box-alpha": boxOpacity / 100,
                    "--rh-hero-box-width": `${box.width}px`,
                    "--rh-hero-box-padding": `${box.padding}px`,
                    "--rh-hero-text-color": textColor,
                    "--rh-hero-title-size": `${text.title}px`,
                    "--rh-hero-body-size": `${text.body}px`,
                    "--rh-hero-phone-title-size": `${text.phoneTitle}px`,
                    "--rh-hero-phone-body-size": `${text.phoneBody}px`,
                  } as CSSProperties
                }
              >
                <span className="rh-b-kicker">{campaign.eyebrow}</span>
                <h1 id="home-heading" className="rh-b-editable-title">
                  {campaign.title}
                </h1>
                {campaign.description && <p>{campaign.description}</p>}
                <LocalizedClientLink
                  href={hrefFor(campaign.href)}
                  className="rh-b-button"
                >
                  {campaign.action} ↗
                </LocalizedClientLink>
              </div>
            </>
          ) : (
            <LocalizedClientLink
              href={hrefFor(campaign.href)}
              className="rh-b-hero-image-link"
              aria-label={campaign.action}
            >
              <h1 id="home-heading" className="sr-only">
                {campaign.title}
              </h1>
              <picture className="rh-b-hero-photo">
                <source
                  media="(max-width:760px)"
                  srcSet={campaign.mobileImage}
                />
                <img
                  src={campaign.desktopImage}
                  alt={campaign.imageAlt}
                  width={2400}
                  height={800}
                  fetchPriority="high"
                  style={{ objectFit: campaign.imageFit }}
                />
              </picture>
            </LocalizedClientLink>
          )}
        </section>
      ) : (
        <h1 className="sr-only">{seo.title}</h1>
      )}
      <section className="rh-b-section" aria-labelledby="featured-heading">
        <div className="rh-b-section-heading">
          <div>
            <span className="rh-b-kicker">
              {hasFeaturedEdit ? featured.eyebrow : "Product discovery"}
            </span>
            <h2 id="featured-heading">
              {hasFeaturedEdit ? featured.title : "Find your next favorite"}
            </h2>
          </div>
          <LocalizedClientLink href="/store" className="rh-b-link">
            Browse categories ↗
          </LocalizedClientLink>
        </div>
        <div className="rh-b-featured-grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
      {explore.enabled && (
        <section
          className="rh-b-section rh-b-collections"
          aria-labelledby="collections-heading"
        >
          <h2
            id="collections-heading"
            className={explore.showHeading ? undefined : "sr-only"}
          >
            {explore.heading}
          </h2>
          {explore.items
            .filter((c) => c.enabled)
            .map((c, i) => (
              <article
                className={`rh-b-collection${i % 2 ? " rh-b-reverse" : ""}${
                  c.showText
                    ? c.textLayout === "overlay"
                      ? " rh-b-collection-overlay"
                      : ""
                    : " rh-b-collection-image-only"
                }`}
                key={c.id}
                style={collectionStyle(c)}
                data-collection-id={c.id}
              >
                <LocalizedClientLink
                  href={hrefFor(c.href)}
                  className="rh-b-collection-photo"
                  aria-label={c.action}
                >
                  <picture>
                    {c.mobileImage && (
                      <source
                        media="(max-width:760px)"
                        srcSet={c.mobileImage}
                      />
                    )}
                    <img
                      src={c.image}
                      alt={c.alt}
                      loading="lazy"
                      width={1200}
                      height={800}
                      style={{
                        objectFit: c.imageFit,
                        padding: c.imageFit === "cover" ? 0 : 18,
                      }}
                    />
                  </picture>
                </LocalizedClientLink>
                {c.showText ? (
                  <div
                    className="rh-b-collection-copy"
                    data-box-clear={c.textBoxOpacity === 0 ? "true" : undefined}
                  >
                    <span className="rh-b-kicker">{c.eyebrow}</span>
                    <h3>{c.title}</h3>
                    {c.description && <p>{c.description}</p>}
                    <LocalizedClientLink
                      href={hrefFor(c.href)}
                      className="rh-b-button"
                    >
                      {c.action} ↗
                    </LocalizedClientLink>
                  </div>
                ) : (
                  <h3 className="sr-only">{c.title}</h3>
                )}
              </article>
            ))}
        </section>
      )}
      <nav className="rh-b-more" aria-label="More collections">
        <span className="rh-b-kicker">More to explore</span>
        <LocalizedClientLink href={hrefFor("/categories/earrings")}>
          Earrings ↗
        </LocalizedClientLink>
        {themes.slice(0, 2).map((c) => (
          <LocalizedClientLink href={`/collections/${c.handle}`} key={c.id}>
            {c.title} ↗
          </LocalizedClientLink>
        ))}
        <LocalizedClientLink href="/store">
          Shop everything ↗
        </LocalizedClientLink>
      </nav>
      <section id="our-story" className="rh-b-story">
        <span className="rh-b-kicker">Our story</span>
        <h2>A little character goes a long way.</h2>
        <p>
          Engraved accessories. Handpainted details. Thoughtful pieces for you,
          your home and the people you love.
        </p>
        <LocalizedClientLink href="/store" className="rh-b-link">
          Explore Rustic Halo ↗
        </LocalizedClientLink>
      </section>
    </div>
  )
}
