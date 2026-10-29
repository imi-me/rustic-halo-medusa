/** Match whole route segments after removing the current storefront country. */
export function navigationIsActive(
  href: string,
  pathname: string,
  countryCode: string,
  hash = ""
) {
  const prefix = `/${countryCode}`
  const localPath =
    pathname === prefix
      ? "/"
      : pathname.startsWith(`${prefix}/`)
      ? pathname.slice(prefix.length)
      : pathname
  const [target, anchor] = href.split("#")
  const path = localPath.replace(/\/$/, "") || "/"
  const destination = target.replace(/\/$/, "") || "/"
  if (anchor) return path === destination && hash === `#${anchor}`
  if (destination === "/" || destination === "/store")
    return path === destination
  return path === destination || path.startsWith(`${destination}/`)
}
