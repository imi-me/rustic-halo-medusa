FROM postgres:17.11-bookworm AS postgres_tools

FROM node:22-bookworm-slim AS source
RUN apt-get update && apt-get install -y --no-install-recommends python3 ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@10.11.1
WORKDIR /app
COPY . .
RUN chmod -R a+rX /app
ENV MEDUSA_DISABLE_TELEMETRY=true NEXT_TELEMETRY_DISABLED=1
RUN pnpm install --frozen-lockfile

FROM source AS backend
RUN apt-get update && apt-get install -y --no-install-recommends libheif-examples util-linux libpq5 && rm -rf /var/lib/apt/lists/*
COPY --from=postgres_tools /usr/lib/postgresql/17/bin/pg_dump /usr/local/bin/pg_dump
COPY --from=postgres_tools /usr/lib/x86_64-linux-gnu/libpq.so.5* /usr/lib/x86_64-linux-gnu/
RUN pnpm --filter @rustic-halo/backend build
ENV NODE_ENV=production APP_ROOT=/app
WORKDIR /app/apps/backend/.medusa/server
USER node
CMD ["pnpm", "exec", "medusa", "start"]

FROM source AS storefront
ARG NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_STRIPE_KEY
ARG NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:19000
ARG NEXT_PUBLIC_BASE_URL=http://localhost:18000
ENV NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=$NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY \
    NEXT_PUBLIC_STRIPE_KEY=$NEXT_PUBLIC_STRIPE_KEY \
    NEXT_PUBLIC_MEDUSA_BACKEND_URL=$NEXT_PUBLIC_MEDUSA_BACKEND_URL \
    NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL \
    NEXT_PUBLIC_DEFAULT_REGION=us
ARG MEDUSA_BUILD_BACKEND_URL=http://127.0.0.1:19000
RUN MEDUSA_BACKEND_URL=$MEDUSA_BUILD_BACKEND_URL pnpm --filter @rustic-halo/storefront build
ENV NODE_ENV=production MEDUSA_BACKEND_URL=http://backend:9000
RUN chown -R node:node /app/apps/storefront/.next
WORKDIR /app/apps/storefront
USER node
CMD ["pnpm", "exec", "next", "start", "-p", "8000"]
