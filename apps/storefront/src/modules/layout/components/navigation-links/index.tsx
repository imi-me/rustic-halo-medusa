"use client"
import { useEffect, useState } from "react"
import { useParams, usePathname } from "next/navigation"
import { navigationIsActive } from "@lib/util/navigation-active"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
export default function NavigationLinks({
  links,
  onNavigate,
}: {
  links: { name: string; href: string }[]
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const { countryCode } = useParams<{ countryCode: string }>()
  const [hash, setHash] = useState("")
  useEffect(() => {
    const sync = () => setHash(window.location.hash)
    sync()
    window.addEventListener("hashchange", sync)
    window.addEventListener("popstate", sync)
    return () => {
      window.removeEventListener("hashchange", sync)
      window.removeEventListener("popstate", sync)
    }
  }, [pathname])
  return (
    <>
      {links.map((link) => (
        <LocalizedClientLink
          key={link.href}
          href={link.href}
          aria-current={
            navigationIsActive(link.href, pathname, countryCode, hash)
              ? "page"
              : undefined
          }
          onClick={() => {
            setHash(
              link.href.includes("#") ? "#" + link.href.split("#")[1] : ""
            )
            onNavigate?.()
          }}
        >
          {link.name}
        </LocalizedClientLink>
      ))}
    </>
  )
}
