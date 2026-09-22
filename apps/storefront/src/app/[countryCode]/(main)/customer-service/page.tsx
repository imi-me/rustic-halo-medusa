import type { Metadata } from "next"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export const metadata: Metadata = {
  title: "Customer Service | Rustic Halo",
  description: "Help with your Rustic Halo order, made-to-order timing, and shipping questions.",
}

export default function CustomerService() {
  return (
    <main className="content-container py-12 small:py-20">
      <div className="max-w-3xl mx-auto">
        <p className="text-sm uppercase tracking-widest text-[#515c49] mb-3">Here to help</p>
        <h1 className="font-serif text-4xl small:text-5xl text-[#30362c] mb-5">Customer service</h1>
        <p className="text-lg text-[#596052] mb-10">
          Have a question about your order? Email{" "}
          <a className="underline underline-offset-4" href="mailto:contact@rustichalo.com">contact@rustichalo.com</a>.
          If you have already ordered, include your order number so we can help.
        </p>
        <div className="space-y-8">
          <section className="bg-[#f5f2ec] border border-[#e3dfd5] rounded-lg p-6 small:p-8">
            <h2 className="font-serif text-2xl mb-3">Made just for you</h2>
            <p>Online orders are made to order and ship in <strong>3–5 business days</strong>.</p>
            <p className="mt-3">This is the time we need to prepare your order before it leaves our shop. Carrier transit time is additional.</p>
          </section>
          <section>
            <h2 className="font-serif text-2xl mb-3">Shipping questions</h2>
            <p className="mb-3">We currently ship only within the United States.</p>
            <p>Shipping options and costs are shown at checkout after you enter your delivery address. For help with a shipment, email us with your order number.</p>
          </section>
          <section id="returns" className="scroll-mt-32">
            <h2 className="font-serif text-2xl mb-3">Returns &amp; order concerns</h2>
            <p>Each online order is made just for you. We do not accept returns simply because you no longer want an item, including personalized items.</p>
            <h3 className="font-semibold mt-5 mb-2">Damaged, defective, or incorrect items</h3>
            <p>If your order arrives damaged, has a defect, or is incorrect—including an error we made in personalization—please contact us promptly with your order number, a description of the issue, and photos. We will review the details with you and cover the cost of resolving damage, defects, or mistakes on our part.</p>
            <h3 className="font-semibold mt-5 mb-2">Other circumstances</h3>
            <p>If you have another concern, please contact us. We review these requests individually based on the circumstances; contacting us does not guarantee a return or refund.</p>
            <p className="mt-3">Please contact us for approval before sending any item back. If a return is approved, we will explain the next steps and any applicable return-shipping costs.</p>
          </section>
          <section>
            <h2 className="font-serif text-2xl mb-3">Need help with an order?</h2>
            <p>For questions about an item, an address correction, or a problem with your order, contact us so we can review the details with you.</p>
            <a href="mailto:contact@rustichalo.com?subject=Order%20help" className="inline-block mt-5 rounded-md bg-[#515c49] px-6 py-3 text-white hover:bg-[#3f4938]">Email Rustic Halo</a>
          </section>
        </div>
        <LocalizedClientLink href="/account/orders" className="inline-block mt-10 underline underline-offset-4">View orders in your account</LocalizedClientLink>
      </div>
    </main>
  )
}
