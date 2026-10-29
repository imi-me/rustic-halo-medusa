"use client"
import { useEffect, useRef } from "react"
import NavigationLinks from "@modules/layout/components/navigation-links"

export default function TopMenu({
  links,
}: {
  links: { name: string; href: string }[]
}) {
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && ref.current) ref.current.open = false
    }
    document.addEventListener("keydown", close)
    return () => document.removeEventListener("keydown", close)
  }, [])
  return (
    <details ref={ref} className="rh-b-top-menu">
      <summary data-testid="nav-menu-button" aria-label="Open navigation menu">
        Menu +
      </summary>
      <nav aria-label="Mobile navigation" data-testid="nav-menu-popup">
        <NavigationLinks
          links={links}
          onNavigate={() => {
            if (ref.current) ref.current.open = false
          }}
        />
      </nav>
    </details>
  )
}
