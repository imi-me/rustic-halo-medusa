import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy | Rustic Halo",
  description: "How Rustic Halo uses and protects information for store accounts, orders, and customer service.",
}

export default function PrivacyPolicy() {
  return (
    <main className="content-container py-12 small:py-20">
      <div className="max-w-3xl mx-auto">
        <p className="text-sm uppercase tracking-widest text-[#515c49] mb-3">Your information</p>
        <h1 className="font-serif text-4xl small:text-5xl text-[#30362c] mb-4">Privacy policy</h1>
        <p className="text-sm text-[#6b7065] mb-10">
          Last updated September 22, 2026. Effective when the new Rustic Halo store launches.
        </p>

        <div className="space-y-8 text-[#454b41]">
          <section>
            <h2 className="font-serif text-2xl text-[#30362c] mb-3">Who we are</h2>
            <p>
              Rustic Halo is a brand owned and operated by Ebenstone Co LLC. For privacy questions or requests,
              email <a className="underline underline-offset-4" href="mailto:hello@rustichalo.com">hello@rustichalo.com</a>.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-[#30362c] mb-3">Information we use to run the store</h2>
            <p>
              When you create an account, place an order, or contact us, we collect the information you provide.
              This may include your name, email address, delivery and billing addresses, phone number when supplied,
              order details, personalization details, and messages.
            </p>
            <p className="mt-3">
              We use this information to manage your account, prepare and fulfill orders, provide customer service,
              prevent fraud, resolve order concerns, and maintain business records.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-[#30362c] mb-3">Payments and service providers</h2>
            <p>
              Payments are processed through Stripe. Card details are entered through Stripe&apos;s payment form. We
              receive payment status and transaction information needed to manage the order.
            </p>
            <p className="mt-3">
              We share information only as needed with companies that help operate the store. These may include
              Stripe for payments; Shippo and shipping carriers for delivery; Resend for transactional emails; and
              providers that support hosting, storage, security, and site operations. These providers handle
              information under their own terms and privacy practices.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-[#30362c] mb-3">Order communications</h2>
            <p>
              We use your email address to communicate about your orders and respond to your questions. Creating an
              account or placing an order does not subscribe you to a newsletter.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-[#30362c] mb-3">Cookies</h2>
            <p>
              The store uses cookies and similar technologies for functions such as keeping track of your cart,
              signing you into your account, remembering preferences, and completing checkout. You can control
              cookies in your browser, but blocking them can prevent parts of the store from working. Third-party
              services, including payment services, may also use cookies under their own policies.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-[#30362c] mb-3">Retention and your requests</h2>
            <p>
              We keep information as long as reasonably needed to provide store services, maintain accounting and
              business records, resolve disputes, prevent fraud, and meet legal obligations. The period depends on
              the type of record and why it is needed.
            </p>
            <p className="mt-3">
              To ask about access to, correction of, or deletion of your information, email us. We may need to verify
              your identity. Some records may need to be retained for order handling, accounting, fraud prevention,
              or legal obligations. Available rights and exceptions depend on applicable law.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-[#30362c] mb-3">Security and changes</h2>
            <p>
              We use reasonable administrative and technical measures intended to protect store information. No
              online service can guarantee absolute security.
            </p>
            <p className="mt-3">
              We will update this page when our information practices change and show the date of the revised policy.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
