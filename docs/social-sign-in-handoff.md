# Apple and Google sign-in — staging preparation

Updated October 10, 2026. Dedicated Apple resource registration is complete;
provider implementation and activation remain pending. Owner chose invite-only
staff access without public admin signup, authenticated staff linking, password
fallback, and separate frontend credentials. Google remains outside this milestone.

## Dedicated Rustic Halo identities — verified October 10

Apple team: `5JHR3HD6LD`. Both primary App IDs have Sign in with Apple enabled.

| Scope | Primary App ID | Registered staging Services ID | Registered key |
| --- | --- | --- | --- |
| Admin | `com.rustichalo.admin` (CKUT28789U) | `com.rustichalo.admin.staging.web` | `67K2UNT76B` |
| Storefront | `com.rustichalo.storefront` | `com.rustichalo.storefront.staging.web` | `U4WX8S79C6` |

Keys are named Rustic Halo Admin Sign in with Apple and Rustic Halo Storefront
Sign in with Apple. Downloaded both privately and verified each registered key's
Enabled Services configuration points only to its matching primary App ID.
No Market Suite or Prompt Studio credential reuse. Key files are PKCS8 PEM in
ignored `.local/admin-apple/private-keys` with mode 0600; never commit or display.
Apple web sign-in uses Services IDs and private signing keys, not distribution
or Apple Pay certificates. Registration proof: `.local/admin-apple/keys-registered.png`;
scope proofs: `admin-key-registered-scope.png`, `storefront-key-registered-scope.png`
in the same directory. Nonsecret plan: `.local/admin-apple/registration-plan.json`.

Owner requested 1Password storage. Created dedicated environment Rustic Halo
Staging (`wslbzvjijofrtsw5nbmudjivci`). Private import uses the local 1Password MCP
without printing secret values. Connection approval completed; append succeeded
and all ten variable names were verified. Separate APPLE_ADMIN and
APPLE_STOREFRONT PRIVATE_KEY_PEM values were concealed. Matching APP_ID, CLIENT_ID,
KEY_ID and TEAM_ID metadata are stored under each prefix. Report:
`.local/admin-apple/1password-storage-report.json`. Keys are valid PKCS8 PEM and
have different public keys. No local .env mount was created.

Services ID web capabilities/callbacks are still unconfigured. Trusted HTTPS
staging returns 404 at /app/login and /health because existing proxy routes only
to the storefront. Backend path routing, Secure cookies, exact callback acceptance,
provider implementation, staff linking and real browser verification remain.
No runtime deployment, account/identity link or Access/DNS change in this milestone.

## Verified starting point

Backend uses Medusa 2.21.0; its installed Google auth provider verifies signed
ID tokens, issuer, audience and verified email. Auth currently uses default
email/password registration. Storefront completeLogin explicitly rejects
third-party location responses. Admin has an existing blue login widget and
Overview; preserve these alongside all unrelated working-tree changes.

Staging Admin is accessed through the private SSH tunnel at
http://localhost:19000/app/login. Compose ADMIN_CORS/AUTH_CORS are loopback-only.
Apple web authentication requires registered HTTPS domain/return URLs, so this
private HTTP entry cannot simply be registered as its Apple callback. Establish
and review callback routing before setting provider credentials. Do not weaken
Secure cookies, TLS verification, or Cloudflare Access to make OAuth work.

Production remains protected at production-preview.rustichalo.com. Public
rustichalo.com remains Shopify. Production email delivery/reset and commerce
launch gates remain disabled. Existing email environment wiring, CID branding,
hello reply-to, and staging Compose project identity must be preserved.

## Implementation requirements

- Keep email/password login available for both actor types.
- Use separate provider identities for staff and customers, e.g. google-staff,
  apple-staff, google-customer and apple-customer. Restrict them using
  projectConfig.http.authMethodsPerActor; customer identities must not be usable
  to acquire a staff session.
- Staff social sign-in must link to an existing authorized staff account through
  an authenticated linking action. Never create an admin from a successful
  Google/Apple login or trust an email supplied by the browser. Do not use the
  documentation's create-user example without replacing that provisioning flow.
- Link existing customer accounts only with explicit proof of the existing
  account. Never merge accounts merely because email strings match. Apple Hide
  My Email must remain usable; identify social accounts by verified issuer/sub.
- Use a maintained OIDC verification library for Apple; validate signature,
  allowed algorithm, issuer, audience, expiry and nonce. Generate Apple client
  assertions server-side from the private key. Never ship credentials to the UI.
- Bind short-lived, one-use state/nonce to the initiating browser, environment,
  actor and provider. Consume it atomically and reject replay, expired/missing
  state, cross-actor callbacks and unapproved return URLs. Persist state in the
  existing backend infrastructure, not per-process memory.
- Apple name is supplied only during initial authorization; do not overwrite
  existing names with missing later values or trust the unsigned user object as
  authorization evidence. Handle Apple's form_post response before redirecting
  to an approved UI destination; return no-store responses without credentials
  in redirects/logs. Confirm Access interaction without publishing a bypass.
- Backend is authoritative about provider availability. Hide login buttons until
  the corresponding actor/provider is configured and enabled for staging.
- Retain existing customer cart transfer, customer cache refresh and HTTP-only
  cookie behavior. Verify staff sessions against /admin/users/me and customer
  sessions against /store/customers/me, with logout/relaunch acceptance.

## Provider setup needed

Dedicated resource IDs and downloaded-key status are recorded above. Exact
HTTPS callback routing must be implemented and verified before Services ID web
configuration. Store signing credentials server-side with separate actor namespaces.

Anonymous staging /admin/users and /admin/users/me return 401. Native Medusa
acceptInviteWorkflow requires a valid invitation token before staff creation.
The emailpass registration identity used during invite acceptance is not public
admin provisioning; do not block it in a way that breaks valid invitations.
Google requires a web OAuth client, consent branding, exact redirect URLs and
staging test users. Request only openid/email/profile, not Gmail mailbox access.
Apple requires a Sign in with Apple-enabled primary App ID, associated Services
ID, Team ID, Key ID and a private signing key, with exact HTTPS domains/return
URLs. Existing Apple Developer membership does not establish these resources.
Determine the staging HTTPS callback design before generating the final provider
registration list. Store credentials privately; never paste them into chat/docs.
Use independent environment configuration and avoid automatic production enable.

## Focused acceptance before promotion

Test staff linking and existing authorized login; reject unlinked outsiders and
customer credentials at staff routes. Test new customers, existing-account
linking, Apple relay addresses, cancellation, replay/state/nonce failures, invalid
issuer/audience/signature and open redirects. Verify password login, logout,
customer cart transfer and no role escalation. Complete real Google and Apple
browser journeys in staging, then coordinate a single scoped production release
with Store config. Production enabling is separate from public launch and must
preserve Shopify, Access, payments, inventory and checkout protections.

## References

- https://docs.medusajs.com/resources/how-to-tutorials/how-to/admin/auth
- https://docs.medusajs.com/resources/commerce-modules/auth/auth-providers/google
- https://docs.medusajs.com/resources/storefront-development/customers/third-party-login
- https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web
- https://developers.google.com/identity/protocols/oauth2/web-server

## Staff Apple implementation — October 10

Implemented provider apple-staff, login.after and profile.details.after widgets,
HTTPS backend path routing on existing staging host, protected staff linking,
and Redis browser-bound one-use transactions/grants. Apple form_post exchanges
its code server-side and redirects to a top-level GET to validate Lax browser
binding. Verified issuer/sub resolves only an existing staff link; no email
matching, admin creation or customer-provider activation. Native Medusa callback
retains MFA/verification token checks; MFA users retain password sign-in.

Focused verification: 17 Jest tests, 20 configuration/JWT checks, six real Redis
security checks (wrong browser, concurrent consume, replay, expiry, namespace,
rate limit), TypeScript and native Medusa backend/Admin build passed. Build has
0 lint errors and advisory warnings, including existing project warnings.

Private signing key upload into Coolify was rejected by automatic approval
review because 1Password storage approval did not cover that credential
destination. No key was transferred. Release defaults APPLE_ADMIN_ENABLED=false;
HTTPS callback routing must be verified before Apple Services ID activation.
Remaining: deploy and verify HTTPS route, owner approval for dedicated Admin key
in private staging Coolify and Apple web callback activation, enable provider,
authenticated staff link and real Apple login acceptance. No production changes.
