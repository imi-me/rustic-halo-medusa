import Nav from "@modules/layout/templates/nav"
import Footer from "@modules/layout/templates/footer"
export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Nav />
      <div data-testid="checkout-container">{children}</div>
      <Footer />
    </>
  )
}
