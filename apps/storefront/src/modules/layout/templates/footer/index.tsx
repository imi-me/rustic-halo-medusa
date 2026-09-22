import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Facebook } from "@medusajs/icons"

export default function Footer() {
  return (
    <footer className="rh-footer">
      <div className="rh-footer-top">
        <div>
          <LocalizedClientLink href="/" className="rh-footer-brand">Rustic Halo</LocalizedClientLink>
          <p>Nature-inspired. Uniquely you.</p>
        </div>
        <div>
          <h2>Explore</h2>
          <LocalizedClientLink href="/store">Shop</LocalizedClientLink>
          <LocalizedClientLink href="/account">Your account</LocalizedClientLink>
          <LocalizedClientLink href="/cart">Your cart</LocalizedClientLink>
          <LocalizedClientLink href="/customer-service">Customer service</LocalizedClientLink>
          <LocalizedClientLink href="/customer-service#returns">Shipping &amp; returns</LocalizedClientLink>
          <LocalizedClientLink href="/privacy">Privacy policy</LocalizedClientLink>
          <LocalizedClientLink href="/terms">Store terms</LocalizedClientLink>
        </div>
        <div>
          <h2>Let’s keep in touch</h2>
          <a href="mailto:contact@rustichalo.com">contact@rustichalo.com</a>
          <div className="rh-footer-social" aria-label="Rustic Halo on social media">
            <a href="https://www.instagram.com/rustichalo" target="_blank" rel="noopener noreferrer" aria-label="Rustic Halo on Instagram (opens in a new tab)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" /></svg>
              <span>Instagram</span>
            </a>
            <a href="https://www.facebook.com/rustichalo" target="_blank" rel="noopener noreferrer" aria-label="Rustic Halo on Facebook (opens in a new tab)">
              <Facebook aria-hidden="true" />
              <span>Facebook</span>
            </a>
          </div>
        </div>
      </div>
      <div className="rh-footer-bottom">
        <span>© {new Date().getFullYear()} Rustic Halo. All rights reserved.</span>
        <span>A little nature in your everyday.</span>
      </div>
    </footer>
  )
}
