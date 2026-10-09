import { CSSProperties } from "react"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import styles from "./home.module.css"

// Display the approved concept's clean original photography as CSS windows.
// The reference file is preserved byte-for-byte; no product records use it.
function EditorialPhoto({ region, label, className = "" }: { region: [number, number, number, number]; label: string; className?: string }) {
  const [x, y, width, height] = region
  const style: CSSProperties = {
    backgroundImage: "url('/brand/home-editorial-reference.png')",
    backgroundSize: `${1015 / width * 100}% ${1550 / height * 100}%`,
    backgroundPosition: `${x / (1015 - width) * 100}% ${y / (1550 - height) * 100}%`,
  }
  return <div role="img" aria-label={label} className={`${styles.editorialPhoto} ${className}`} style={style} />
}

export default function Hero({ collections }: { collections: HttpTypes.StoreCollection[] }) {
  const collectionHref = (handle: string) => collections.some((collection) => collection.handle === handle) ? `/collections/${handle}` : "/store"
  const hairHref = collectionHref("hair-accessories-claws-and-clips")
  const jewelryHref = collectionHref("earrings")
  const giftsHref = collectionHref("gifts-home-decor")
  const categories = [
    { label: "Hair Claws", href: hairHref, region: [33, 443, 312, 202] as [number, number, number, number], alt: "Floral wooden hair claw in soft natural light" },
    { label: "Jewelry", href: jewelryHref, region: [358, 443, 301, 202] as [number, number, number, number], alt: "Leaf engraved wooden earrings" },
    { label: "Thoughtful Gifts", href: giftsHref, region: [671, 443, 312, 202] as [number, number, number, number], alt: "Handcrafted wooden gifts with botanical and mountain details" },
  ]
  const favorites = [
    { label: "Hair Claws", href: hairHref, region: [33, 771, 229, 174] as [number, number, number, number], alt: "Floral wooden hair claw" },
    { label: "Jewelry", href: jewelryHref, region: [274, 771, 228, 174] as [number, number, number, number], alt: "Mountain engraved wooden earrings" },
    { label: "Gifts", href: giftsHref, region: [514, 771, 228, 174] as [number, number, number, number], alt: "Earth toned beaded bracelet" },
    { label: "Gifts", href: giftsHref, region: [755, 771, 228, 174] as [number, number, number, number], alt: "Mountain engraved wooden pendant" },
  ]

  return (
    <div className={styles.home}>
      <section className={styles.hero} aria-labelledby="home-heading">
        <EditorialPhoto region={[445, 50, 570, 380]} label="Floral wooden hair claws on pale stone" className={styles.heroImage} />
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Handmade accessories &amp; gifts</p>
          <h1 id="home-heading">Made for you.<br />Made to be noticed.</h1>
          <p className={styles.heroDescription}>Thoughtfully crafted accessories and gifts<br className={styles.desktopBreak} /> for everyday moments and meaningful ones.</p>
          <div className={styles.heroActions}><LocalizedClientLink href="/store" className={styles.primaryButton}>Explore the collection <span aria-hidden="true">→</span></LocalizedClientLink></div>
        </div>
      </section>

      <section id="collections" className={styles.section} aria-labelledby="categories-heading">
        <h2 id="categories-heading" className="sr-only">Shop by category</h2>
        <div className={styles.categoryGrid}>
          {categories.map((tile) => <LocalizedClientLink href={tile.href} key={tile.label} className={styles.categoryCard} aria-label={`Shop ${tile.label}`}>
            <EditorialPhoto region={tile.region} label={tile.alt} className={styles.categoryImage} />
            <span className={styles.categoryLabel}><span>{tile.label}</span><span className={styles.categoryAction} aria-hidden="true">→</span></span>
          </LocalizedClientLink>)}
        </div>
      </section>

      <section id="best-sellers" className={`${styles.section} ${styles.bestSellers}`} aria-labelledby="best-sellers-heading">
        <div className={styles.sectionHeading}><h2 id="best-sellers-heading">Discover your next favorite</h2></div>
        <hr className={styles.fullWidthRule} />
        <div className={styles.productGrid}>{favorites.map((tile, index) => <LocalizedClientLink href={tile.href} key={`${tile.label}-${index}`} className={styles.favoriteCard} aria-label={`Explore ${tile.label}`}>
          <EditorialPhoto region={tile.region} label={tile.alt} className={styles.favoriteImage} />
          <span>{tile.label}</span>
        </LocalizedClientLink>)}</div>
      </section>

      <section className={styles.personalization} aria-labelledby="personalization-heading">
        <EditorialPhoto region={[0, 998, 473, 249]} label="Floral hair claw securing a loose bun" className={styles.personalizationImage} />
        <div className={styles.personalizationCopy}>
          <h2 id="personalization-heading">Personalized just for you.</h2>
          <p>Make it meaningful with custom touches<br className={styles.desktopBreak} /> that tell your story.</p>
          <LocalizedClientLink href={hairHref} className={styles.primaryButton}>Explore personalized pieces <span aria-hidden="true">→</span></LocalizedClientLink>
          <div className={styles.botanicalDetail} aria-hidden="true">
            <svg viewBox="0 0 70 140" fill="none" stroke="currentColor" strokeWidth="1"><path d="M5 134C27 96 27 47 55 6M27 89C5 82 10 65 26 87M30 73C50 67 53 48 32 68M34 57C19 48 23 34 36 53M41 40C62 33 64 18 45 34M48 23C40 15 42 5 53 14M20 107C40 103 46 87 23 101" /></svg>
            <span>Simple things<br />mean more</span><i />
          </div>
        </div>
      </section>

      <section id="our-story" className={styles.story} aria-labelledby="story-heading">
        <div>
          <p className={styles.eyebrow}>Our story</p>
          <h2 id="story-heading">Rooted in the little things.</h2>
          <p>Rustic Halo began with a love for handcrafted details and the belief that everyday items can be extraordinary. We create accessories and gifts that bring a bit more beauty, intention, and joy to your day.</p>
        </div>
        <EditorialPhoto region={[447, 1258, 568, 207]} label="A handmade ceramic mug with flowers in soft window light" className={styles.storyImage} />
      </section>
    </div>
  )
}
