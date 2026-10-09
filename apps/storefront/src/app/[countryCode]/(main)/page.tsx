import { Metadata } from "next"
import Hero from "@modules/home/components/hero"
import { listCollections } from "@lib/data/collections"


export const metadata: Metadata = {
  title: "Rustic Halo | Laser cut, engraved, and handpainted products",
  description: "Makers of laser cut, engraved, and handpainted products.",
}
export default async function Home() {
  const { collections } = await listCollections()
  return <Hero collections={collections} />
}
