import { HttpTypes } from "@medusajs/types"
import { getProductPrice } from "@lib/util/get-product-price"
import { isProductSoldOut } from "@lib/util/product-availability"
import { brandAssets, brandCollections } from "@lib/brand/assets"
import { availableHomeCollections } from "@lib/brand/home-collections"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"
import HomeProductCard, { HomeColor, HomeProduct } from "@modules/home/components/product-card"
import styles from "./home.module.css"

const valuePoints = [
  "Inspired by Nature",
  "Full of Personality",
  "Thoughtful Gifts",
  "Made to Order",
]

function cardData(product: HttpTypes.StoreProduct): HomeProduct {
  const variants = product.variants || []
  const colorOption = product.options?.find((option) => /^(base |claw )?colou?r$/i.test(option.title || ""))
  const isHairClaw = product.collection?.handle === "hair-accessories-claws-and-clips" || /hair claw/i.test(product.title || "")
  const seen = new Set<string>()
  const colors: HomeColor[] = []

  if (isHairClaw && colorOption) {
    for (const variant of variants) {
      const value = variant.options?.find((option) => option.option_id === colorOption.id || option.option?.id === colorOption.id)?.value
      if (!value || seen.has(value)) continue
      seen.add(value)
      colors.push({ label: value, variantId: variant.id, image: variant.images?.[0]?.url || undefined })
    }
  }

  const prices = new Set(variants.map((variant) => variant.calculated_price?.calculated_amount).filter((amount) => typeof amount === "number"))
  const price = getProductPrice({ product }).cheapestPrice?.calculated_price

  return {
    id: product.id,
    handle: product.handle || "",
    title: product.title || "Rustic Halo product",
    image: product.thumbnail || product.images?.[0]?.url || undefined,
    price: price ? `${prices.size > 1 ? "From " : ""}${price}` : undefined,
    soldOut: isProductSoldOut(product),
    hasOptions: variants.length > 1 || !!product.options?.some((option) => !/^title$/i.test(option.title || "")),
    colors,
  }
}

export default function Hero({ products, collections }: { products: HttpTypes.StoreProduct[]; collections: HttpTypes.StoreCollection[] }) {
  const categoryTiles = availableHomeCollections(collections)
  const hairClaws = categoryTiles.find((tile) => tile.handle === "hair-accessories-claws-and-clips")
  const gifts = categoryTiles.find((tile) => tile.handle === "gifts-home-decor")
  const cards = products.filter((product) => product.handle).map(cardData)

  return (
    <main className={styles.home}>
      <section className={styles.hero} aria-labelledby="home-heading">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Small details. Big meaning.</p>
          <h1 id="home-heading">Made for you.<br />Made to be noticed.</h1>
          <p className={styles.heroDescription}>Nature-inspired accessories, personalized gifts and little details that make something yours.</p>
          <div className={styles.heroActions}>
            <a href="#best-sellers" className={styles.primaryButton}>Shop best sellers</a>
            {hairClaws && <LocalizedClientLink href={`/collections/${hairClaws.handle}`} className={styles.secondaryButton}>Shop hair claws <span aria-hidden="true">→</span></LocalizedClientLink>}
          </div>
        </div>
        <div className={styles.heroImage}>
          <Image src={brandCollections[1].image} alt="Rustic Halo decorative hair claws" fill priority sizes="(max-width: 760px) 100vw, 54vw" />
        </div>
      </section>

      {categoryTiles.length > 0 && (
        <section id="collections" className={styles.section} aria-labelledby="categories-heading">
          <div className={styles.sectionHeading}><h2 id="categories-heading">Shop by Category</h2></div>
          <div className={styles.categoryGrid}>
            {categoryTiles.map((tile) => (
              <LocalizedClientLink href={`/collections/${tile.handle}`} key={tile.handle} className={styles.categoryCard} aria-label={`Shop ${tile.label}`}>
                <span className={styles.categoryImage}><Image src={tile.image} alt={tile.alt} fill sizes="(max-width: 560px) 46vw, (max-width: 900px) 46vw, 23vw" /></span>
                <span className={styles.categoryLabel}><span>{tile.label}</span><span className={styles.categoryAction}>Shop <span aria-hidden="true">→</span></span></span>
              </LocalizedClientLink>
            ))}
          </div>
        </section>
      )}

      {cards.length > 0 && (
        <section id="best-sellers" className={`${styles.section} ${styles.bestSellers}`} aria-labelledby="best-sellers-heading">
          <div className={styles.sectionHeading}>
            <div><h2 id="best-sellers-heading">Best Sellers</h2><p>Customer favorites, made one at a time.</p></div>
            <LocalizedClientLink href="/store" className={styles.sectionLink}>Shop all <span aria-hidden="true">→</span></LocalizedClientLink>
          </div>
          <div className={styles.productGrid}>{cards.map((product) => <HomeProductCard key={product.id} product={product} />)}</div>
        </section>
      )}

      <section className={styles.valueStrip} aria-label="The Rustic Halo difference">
        <div>{valuePoints.map((point) => <span key={point}>{point}</span>)}</div>
      </section>

      <section className={styles.personalization} aria-labelledby="personalization-heading">
        <div className={styles.personalizationImage}><Image src={brandAssets.hero} alt="Rustic Halo earrings and accessories displayed on wood" fill sizes="(max-width: 760px) 100vw, 50vw" /></div>
        <div className={styles.personalizationCopy}>
          <p className={styles.eyebrow}>Made a little more yours</p>
          <h2 id="personalization-heading">Personalized just for you.</h2>
          <p>Choose your design, color and the details that feel like you. We make your piece to order, one thoughtful detail at a time.</p>
          <LocalizedClientLink href={hairClaws ? `/collections/${hairClaws.handle}` : "/store"} className={styles.primaryButton}>Personalize yours <span aria-hidden="true">→</span></LocalizedClientLink>
        </div>
      </section>

      <section id="our-story" className={styles.story} aria-labelledby="story-heading">
        <div>
          <p className={styles.eyebrow}>The Rustic Halo spirit</p>
          <h2 id="story-heading">Rooted in the little things.</h2>
          <p>Wood grain, leafy shapes and a little personality. Find something for your everyday, your home or someone you love.</p>
          <LocalizedClientLink href={gifts ? `/collections/${gifts.handle}` : "/store"} className={styles.sectionLink}>Explore thoughtful gifts <span aria-hidden="true">→</span></LocalizedClientLink>
        </div>
        <div className={styles.trust} aria-label="Shopping with Rustic Halo">
          <span>Made to Order</span><span>Small Business</span><span>Secure Checkout</span><span>Ships in 3–5 Business Days</span>
        </div>
      </section>
    </main>
  )
}
