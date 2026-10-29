import { getHomepageContent } from "@lib/data/homepage-content"
import { Metadata } from "next"
import Hero from "@modules/home/components/hero"
import { listCollections } from "@lib/data/collections"

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getHomepageContent()
  return {
    title: seo.title,
    description: seo.description,
    openGraph: { title: seo.title, description: seo.description },
  }
}
export default async function Home({
  params,
}: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params
  const { collections } = await listCollections()
  return <Hero collections={collections} countryCode={countryCode} />
}
