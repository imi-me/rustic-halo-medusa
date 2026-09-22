"use client"
import { useParams } from "next/navigation"

export default function HeaderSearch() {
  const { countryCode } = useParams<{ countryCode: string }>()
  return <form className="rh-search" action={`/${countryCode}/store`} role="search">
    <label className="sr-only" htmlFor="header-search">Search products</label>
    <input id="header-search" type="search" name="q" placeholder="Search products…" maxLength={160} required />
    <button type="submit" aria-label="Search products"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="m15 15 5 5" stroke="currentColor" strokeWidth="1.5"/></svg></button>
  </form>
}
