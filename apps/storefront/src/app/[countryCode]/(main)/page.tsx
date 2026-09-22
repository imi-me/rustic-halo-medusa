import { Metadata } from "next"
import Hero from "@modules/home/components/hero"
import { listProducts } from "@lib/data/products"
import { listCollections } from "@lib/data/collections"

// These are existing Medusa product handles, used only until a merchandised
// best-sellers collection is maintained in Admin. Product details stay live.
const featuredHandles = [
  "round-medallion-cutout-earring",
  "floral-cross-dangle-earrings",
  "scalloped-beach-hair-claw",
  "jeep-hair-claws",
  "welcome-succas-novelty-sign",
  "daffodil-hi-round-sign-copy",
]

export const metadata: Metadata = {
  title: "Rustic Halo | Nature-inspired accessories & home décor",
  description: "Discover nature-inspired earrings, hair claws, and joyful accents for your home from Rustic Halo.",
}
export default async function Home(props: { params: Promise<{ countryCode: string }> }) {
  const { countryCode } = await props.params
  const { collections } = await listCollections()
  const bestSellers = collections.find((collection) => collection.handle === "best-sellers")
  const products = bestSellers
    ? (await listProducts({ countryCode, queryParams: { collection_id: bestSellers.id, limit: 8 } })).response.products
    : (await listProducts({ countryCode, queryParams: { handle: featuredHandles, limit: featuredHandles.length } })).response.products

  return <Hero products={products} collections={collections} />
}
