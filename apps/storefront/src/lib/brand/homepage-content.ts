import defaults from "./homepage-defaults.json"
export type EditorialCopy = {
  enabled: boolean
  showText: boolean
  eyebrow: string
  title: string
  description: string
  href: string
  action: string
  imageFit: "cover" | "contain"
}
export type HomepageContent = {
  version: 1
  hero: EditorialCopy & {
    textBoxOpacity: number
    textBoxPosition: "left" | "center" | "right"
    textBoxSize: "compact" | "standard" | "wide"
    textColor: "original" | "dark" | "light" | "custom"
    customTextColor: string
    textSize: "small" | "standard" | "large"
    desktopImage: string
    mobileImage: string
    imageAlt: string
  }
  explore: {
    enabled: boolean
    showHeading: boolean
    heading: string
    items: Array<
      EditorialCopy & {
        id: string
        image: string
        mobileImage: string
        alt: string
      }
    >
  }
  seo: { title: string; description: string }
}
export const defaultHomepageContent = defaults as HomepageContent
