import "server-only"
import { cache } from "react"
import { sdk } from "@lib/config"
import {
  defaultHomepageContent,
  type HomepageContent,
} from "@lib/brand/homepage-content"
/** Request-scoped sharing; published changes appear on the next page request. */
export const getHomepageContent = cache(async (): Promise<HomepageContent> => {
  try {
    const result = await sdk.client.fetch<{ content: HomepageContent }>(
      "/store/storefront-content",
      { cache: "no-store" }
    )
    return result.content?.version === 1
      ? result.content
      : defaultHomepageContent
  } catch {
    return defaultHomepageContent
  }
})
