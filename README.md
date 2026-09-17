# Rustic Halo Commerce

Production commerce application for Rustic Halo, built on Medusa 2 and the official Medusa DTC storefront.

## Repository layout

```text
apps/
  backend/       Medusa server, Admin, workflows, and commerce customizations
  storefront/    Next.js customer storefront
  kiosk/         Copper Mill personalization kiosk boundary and future client
docs/             Architecture decisions and operating flows
integrations/
  etsy/           Etsy catalog, order, and inventory synchronization boundary
  marketsuite/    MarketSuite POS, barcode, payment-confirmation, and production boundary
```

The kiosk and integration directories intentionally contain contracts and implementation plans, not speculative production code. New behavior should be implemented against those documented boundaries as credentials and vendor API details become available.

## Prerequisites

- Node.js 20.19+ or 22.12+ LTS. Node 25+ is not supported by the current storefront.
- pnpm 10.11.1, enabled with Corepack
- PostgreSQL 15+
- Redis for production and recommended for local integration work

## Local setup

```bash
corepack enable
pnpm install --frozen-lockfile
cp apps/backend/.env.template apps/backend/.env
cp apps/storefront/.env.template apps/storefront/.env.local
```

Create a PostgreSQL database named `rustic_halo`, then set `DATABASE_URL` in `apps/backend/.env`. Replace all example secrets before using any shared environment.

```bash
pnpm --dir apps/backend medusa db:migrate
pnpm --dir apps/backend medusa user -e admin@example.com -p 'replace-this-password'
pnpm dev
```

The Medusa API and Admin run at `http://localhost:9000` and `http://localhost:9000/app`. The storefront runs at `http://localhost:8000`.

After signing in to Admin, create a publishable API key and put it in `apps/storefront/.env.local` as `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Run backend and storefront in development mode |
| `pnpm backend:dev` | Run only Medusa and Admin |
| `pnpm storefront:dev` | Run only the storefront |
| `pnpm build` | Build every implemented workspace |
| `pnpm lint` | Lint every implemented workspace |
| `pnpm test` | Run workspace tests |
| `pnpm backend:seed` | Load the starter development catalog |

## Architecture

Read [docs/architecture.md](docs/architecture.md) before implementing inventory, POS, Etsy, kiosk, personalization, or production workflows. It records the business invariants that integrations must preserve.

## Delivery workflow

`develop` remains the protected integration/default branch. Work in short-lived branches, require the CI checks in `.github/workflows/ci.yml`, review the preview environment, and merge through a pull request. Production deployments should be promoted from a reviewed long-lived branch rather than from an unreviewed local push.

## Deployment

The monorepo layout is compatible with Medusa Cloud. Configure the backend root as `apps/backend` and the storefront root as `apps/storefront`. For self-hosting, deploy the backend/Admin with PostgreSQL and Redis first, then deploy the storefront with the backend URL and publishable API key.

Never commit `.env` files, API credentials, payment data, or customer data.
