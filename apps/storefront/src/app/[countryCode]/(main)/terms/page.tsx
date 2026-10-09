import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Store Terms | Rustic Halo",
  description: "Rustic Halo order, shipping, returns, and account terms.",
}

export default function StoreTerms() {
  return (
    <main className="content-container py-12 small:py-20">
      <div className="max-w-3xl mx-auto">
        <p className="text-sm uppercase tracking-widest text-[#515c49] mb-3">Shopping with us</p>
        <h1 className="font-serif text-4xl small:text-5xl text-[#30362c] mb-4">Store terms</h1>
        <p className="text-sm text-[#6b7065] mb-10">
          Last updated September 22, 2026. Effective when the new Rustic Halo store launches.
        </p>

        <div className="space-y-8 text-[#454b41]">
          <section>
            <h2 className="font-serif text-2xl text-[#30362c] mb-3">About these terms</h2>
            <p>
              These terms apply to purchases through this Rustic Halo online store, operated by Ebenstone Co LLC.
              Email <a className="underline underline-offset-4" href="mailto:hello@rustichalo.com">hello@rustichalo.com</a> with
              questions about an order.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-[#30362c] mb-3">Your order</h2>
            <p>
              Please review the item, selected options, personalization details when offered, and delivery address
              before placing your order. Contact us promptly if something needs correcting. Because products are made
              to order, changes or cancellation may not be possible once work has started; we will review each request
              individually.
            </p>
            <p className="mt-3">
              Product prices are shown on the site. Shipping charges and applicable taxes are shown at checkout.
              Please review the total before submitting payment. An order is accepted when the store confirms it.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-[#30362c] mb-3">Preparation and delivery</h2>
            <p>We currently ship only within the United States. International shipping is not available at launch.</p>
            <p className="mt-3">
              Online products are made to order and normally ship in <strong>3–5 business days</strong>. This is
              preparation time before dispatch; carrier transit time is additional. Shipping services and costs are
              shown at checkout after you enter a delivery address.
            </p>
            <p className="mt-3">
              If we cannot ship within the promised time, we will contact you with the revised timing and give you the
              choice to accept the delay or cancel the affected order for a refund.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-[#30362c] mb-3">Returns and order concerns</h2>
            <p>We do not accept returns simply because you no longer want an item, including personalized items.</p>
            <h3 className="font-semibold mt-5 mb-2">Damaged, defective, or incorrect items</h3>
            <p>
              If your order arrives damaged, has a defect, or is incorrect—including an error we made in
              personalization—please contact us promptly with your order number, a description of the issue, and
              photos. We will review the details with you and cover the cost of resolving damage, defects, or mistakes
              on our part.
            </p>
            <h3 className="font-semibold mt-5 mb-2">Other circumstances</h3>
            <p>
              If you have another concern, please contact us. We review these requests individually based on the
              circumstances; contacting us does not guarantee a return or refund.
            </p>
            <p className="mt-3">
              Please contact us for approval before sending any item back. If a return is approved, we will explain
              the next steps and any applicable return-shipping costs.
            </p>
            <p className="mt-3">These terms do not exclude rights that cannot be excluded under applicable law.</p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-[#30362c] mb-3">Product information and availability</h2>
            <p>
              We work to present product descriptions, options, colors, and images accurately. Colors can look
              different across screens, and handmade or natural materials can have small variations. If an item or
              option becomes unavailable after ordering, we will contact you to resolve the order or provide a refund.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-[#30362c] mb-3">Your account</h2>
            <p>
              Keep your login details private and your account information accurate. Contact us if you believe someone
              has accessed your account without permission.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
