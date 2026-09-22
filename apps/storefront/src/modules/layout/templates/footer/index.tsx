import LocalizedClientLink from "@modules/common/components/localized-client-link"

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
          <a href="https://www.instagram.com/rustichalo" target="_blank" rel="noreferrer">Instagram ↗</a>
          <a href="https://www.facebook.com/rustichalo" target="_blank" rel="noreferrer">Facebook ↗</a>
        </div>
      </div>
      <div className="rh-footer-bottom">
        <span>© {new Date().getFullYear()} Rustic Halo. All rights reserved.</span>
        <span>A little nature in your everyday.</span>
      </div>
    </footer>
  )
}
