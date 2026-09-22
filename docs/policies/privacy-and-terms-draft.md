# Rustic Halo policy drafts

Status: owner review; not published or linked from the storefront. Effective date will be set at launch. These drafts describe the intended Medusa storefront, not the existing Shopify storefront.

## Details to confirm before publication

- Confirmed by owner: Rustic Halo is a brand owned by Ebenstone Co LLC; launch shipping is limited to the United States.
- Production hosting, logging, backups, and any analytics or advertising tools. No analytics or advertising integration was identified in the storefront files reviewed; verify the deployed site before making a no-tracking statement.
- Record retention and the process for handling access, correction, and deletion requests.
- Confirmed launch scope: checkout, customer accounts, and transactional order emails. Newsletters and advertising tracking are deferred. Revisit privacy disclosures and consent requirements before adding either.
- Final payment, shipping, and tax configuration. The present checkout uses test services.

## Privacy policy — draft customer copy

### Who we are

Rustic Halo is a brand owned and operated by Ebenstone Co LLC. For privacy questions, contact contact@rustichalo.com.

### Information used to run the store

When you create an account, place an order, or contact us, we collect the information you provide, such as your name, email address, delivery and billing addresses, phone number when supplied, order details, and messages. We use this information to manage your account, prepare and fulfill orders, answer questions, resolve order issues, and maintain business records.

Payments are processed through Stripe. Card details are entered through Stripe’s payment form. We receive payment status and transaction information needed to manage the order.

### Service providers

We share information needed to carry out store services with the providers involved: Stripe for payments, Shippo and shipping carriers for shipping services, and Resend for order emails. Our hosting and infrastructure providers also process information needed to operate the site. [Confirm production infrastructure and any additional providers before publication.]

### Order communications

We use your email address to communicate about your orders and respond to your questions. Creating an account or placing an order does not subscribe you to a newsletter.

### Cookies

The store uses cookies for functions such as keeping track of your cart, signing you into your account, remembering language preferences, and completing account setup. You can control cookies in your browser, but blocking them can prevent parts of the store from working. Third-party services, including payment services, may also use cookies or similar technologies under their own policies.

### Retention and your requests

[Confirm retention practices before publication.] To ask about access to, correction of, or deletion of your information, email contact@rustichalo.com. We may need to verify your identity. Some records may need to be retained for order handling, accounting, fraud prevention, or legal obligations. Rights and exceptions depend on applicable law.

### Changes

We will update this page when our information practices change and show the effective date of the revised policy.

## Store terms — draft customer copy

### Shopping with Rustic Halo

These terms apply to purchases through this Rustic Halo online store, operated by Ebenstone Co LLC. Contact contact@rustichalo.com with questions about an order.

### Your order

Please review the item, selected options, personalization details when offered, and delivery address before placing your order. Contact us promptly if something needs correcting. Because products are made to order, changes may not be possible once work has started; we will review your request individually.

Product prices are shown on the site. Shipping charges and any applicable taxes are shown at checkout. Please review the total before submitting payment.

### Preparation and delivery

We currently ship only within the United States. International shipping is not available at launch.

Online products are made to order and ship in 3–5 business days. This is preparation time before dispatch; carrier transit time is additional. Shipping services and costs are shown at checkout after a delivery address is entered.

### Returns and order concerns

We do not accept returns simply because you no longer want an item, including personalized items.

If your order arrives damaged, is defective, or is incorrect—including a personalization error we made—contact us promptly with your order number, a description, and photos. We will review the details with you and cover the cost of resolving damage, defects, or mistakes on our part.

For other concerns, contact us for individual review. A request does not guarantee a return or refund. Please get approval before returning an item. If a return is approved, we will explain the next steps and any applicable return-shipping costs.

These terms do not exclude rights that cannot be excluded under applicable law.

### Your account

Keep your login details private and the information in your account accurate. Contact us if you believe someone has accessed your account without your permission.

### Questions

Email contact@rustichalo.com and include your order number when your question concerns a purchase.

## Preparation notes

The confirmed dispatch and return wording comes from the owner’s instructions. Cookie descriptions were checked against `apps/storefront/src/lib/data/cookies.ts` and `locale-actions.ts`. Service-provider descriptions reflect the configured Stripe, Shippo, and Resend integrations. Public hosting and operational retention practices remain unresolved.

FTC guidance emphasizes that businesses must honor their privacy promises: https://www.ftc.gov/business-guidance/privacy-security . The drafts avoid unverified claims about never sharing data, fixed deletion timelines, absolute security, and universal legal rights. Review the final policies for the business’s actual practices and applicable requirements before launch.
