# Development and release workflow

## Branches

- `develop` is the protected integration/default branch.
- Create short-lived branches using `feat/`, `fix/`, or `chore/` prefixes.
- Open a pull request, require CI and review, and use a preview environment before merging.
- Promote a reviewed commit to production through the chosen deployment platform. Do not deploy an unreviewed local branch.

## Local verification

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm lint
pnpm build
```

Backend tests can be run independently:

```bash
pnpm --dir apps/backend test:unit
pnpm --dir apps/backend test:integration:modules
pnpm --dir apps/backend test:integration:http
```

Integration tests require the environment and services documented by the test suite. Never point tests at production databases or vendor accounts.

## Environment handling

Copy the committed templates to local ignored files. Store staging and production values in the deployment platform's secret manager. Rotate placeholder secrets before sharing an environment.

## Database changes

Create Medusa migrations for persistent model changes. Test migrations against a production-like backup in staging and define rollback or forward-fix steps before production release.
