import { Metadata } from "next"
import Hero from "@modules/home/components/hero"
import { listProducts } from "@lib/data/products"

export const metadata: Metadata = {
  title: "Rustic Halo | Nature-inspired accessories & home décor",
  description: "Discover nature-inspired earrings, hair claws, and joyful accents for your home from Rustic Halo.",
}
export default async function Home(props: { params: Promise<{ countryCode: string }> }) {
  const { countryCode } = await props.params
  const { response: { products } } = await listProducts({ countryCode, queryParams: { limit: 12 } })
  return <Hero countryCode={countryCode} products={products} />
}
