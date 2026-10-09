import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"
import BagIcon from "@modules/layout/components/bag-icon"

export default function Footer() {
  return (
    <footer className="rh-footer rh-footer-reference">
      <div className="rh-footer-reference-row">
        <div className="rh-footer-reference-brand">
          <LocalizedClientLink href="/" className="rh-footer-brand" aria-label="Rustic Halo home"><Image src="/brand/rustic-halo-web-logo.png" alt="Rustic Halo" width={512} height={205} className="rh-footer-logo" /></LocalizedClientLink>
          <p>Makers of laser cut, engraved, and handpainted products.</p>
        </div>
        <nav className="rh-footer-reference-nav" aria-label="Footer navigation">
          <LocalizedClientLink href="/store">Shop</LocalizedClientLink>
          <LocalizedClientLink href="/#our-story">Our Story</LocalizedClientLink>
          <LocalizedClientLink href="/customer-service">Contact</LocalizedClientLink>
        </nav>
        <div className="rh-footer-reference-actions">
          <LocalizedClientLink href="/store" className="rh-cart-link" aria-label="Search products"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5" /><path d="m16 16 5 5" stroke="currentColor" strokeWidth="1.5" /></svg></LocalizedClientLink>
          <LocalizedClientLink href="/cart" className="rh-cart-link" aria-label="Your cart"><BagIcon /></LocalizedClientLink>
          <p>Beautiful people<br />Brighter days</p>
        </div>
      </div>
      <div className="rh-footer-reference-support">
        <span>© {new Date().getFullYear()} Rustic Halo.</span>
        <nav aria-label="Support and policies">
          <LocalizedClientLink href="/account">Your account</LocalizedClientLink>
          <LocalizedClientLink href="/customer-service#returns">Shipping &amp; returns</LocalizedClientLink>
          <LocalizedClientLink href="/privacy">Privacy policy</LocalizedClientLink>
          <LocalizedClientLink href="/terms">Store terms</LocalizedClientLink>
          <a href="mailto:hello@rustichalo.com">hello@rustichalo.com</a>
          <a href="https://www.instagram.com/rustichalo" target="_blank" rel="noopener noreferrer" aria-label="Rustic Halo on Instagram (opens in a new tab)">Instagram</a>
          <a href="https://www.facebook.com/rustichalo" target="_blank" rel="noopener noreferrer" aria-label="Rustic Halo on Facebook (opens in a new tab)">Facebook</a>
        </nav>
      </div>
    </footer>
  )
}
