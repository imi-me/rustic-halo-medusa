# Rustic Halo policy review

Status: final owner review. These policies are implemented locally at `/privacy`
and `/terms` and linked from the footer. They are not published. Their effective
date is the launch of the new Rustic Halo store.

## Confirmed business facts

- Rustic Halo is a brand owned and operated by Ebenstone Co LLC.
- Launch shipping is limited to the United States.
- Online products are made to order and normally ship in 3–5 business days;
  carrier transit time is additional.
- Returns are not accepted simply because a customer no longer wants an item.
  Damage, defects, incorrect items, and Rustic Halo personalization mistakes are
  resolved at the business's cost. Other circumstances receive individual
  review, and return approval is required before an item is sent back.
- Customer contact is `contact@rustichalo.com`.
- Accounts, checkout, and transactional emails are in launch scope. Newsletters
  and advertising tracking are deferred.

## Customer-facing implementation

- `apps/storefront/src/app/[countryCode]/(main)/privacy/page.tsx`
- `apps/storefront/src/app/[countryCode]/(main)/terms/page.tsx`
- `apps/storefront/src/app/[countryCode]/(main)/customer-service/page.tsx`
- `apps/storefront/src/modules/layout/templates/footer/index.tsx`

The privacy policy describes the information supplied for accounts, checkout,
orders, personalization, and support; the purposes for using it; payment and
operational service providers; transactional email; cookies; practical
retention; customer requests; and security. It avoids fixed deletion promises,
absolute security claims, and claims about advertising tools that have not been
verified in production.

The store terms preserve the approved order, shipping, and return language. They
also state that a customer will be offered a delay choice or cancellation and
refund when an order cannot ship within the promised time.

## Required launch-day verification

- Verify the deployed provider list, production infrastructure, and absence of
  analytics or advertising tools before publishing the privacy policy.
- Verify live payment, shipping, and tax behavior against the customer-facing
  terms.
- Replace the policy's review date if the wording changes before launch.
- Revisit privacy disclosures and consent before adding newsletters,
  advertising tracking, or new uses of customer information.

## Review basis

The wording reflects the owner-approved business policies and actual storefront
behavior. It is written as plain customer information rather than a claim of
universal legal compliance. FTC guidance requires sellers to have a reasonable
basis for advertised shipping timing and to offer the customer a delay choice
or cancellation/refund when that timing cannot be met. FTC privacy guidance
also emphasizes clear promises that match actual business practices.
