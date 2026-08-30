# AutoParts Marketplace (working name)

A multi-vendor automotive parts marketplace, built Jamaica-first and
Caribbean-ready. See the Phase 0 Discovery & Architecture Report for the
full design rationale — this README covers day-to-day setup only.

## Structure (monorepo, npm workspaces + Turborepo)

```
apps/
  web/      Next.js + TypeScript — customer marketplace, supplier dashboard, admin panel
  mobile/   Expo + React Native + TypeScript — Android/iPhone customer app
  api/      NestJS + TypeScript — the one backend both apps talk to
packages/
  shared/   Zod validation schemas, shared TypeScript types, brand/design tokens
```

Neither frontend talks to the database directly — every business rule
(pricing, inventory, roles) is enforced once, in `apps/api`.

## Prerequisites

- Node.js 20+ (this machine has Node 24 installed)
- npm (ships with Node)
- Git
- PostgreSQL (local install, or a free Railway/Neon database — see below)

## First-time setup

1. Copy `.env.example` to `.env` in `apps/api` and fill in your local
   database URL. **Never commit `.env` — it's already in `.gitignore`.**
2. From the repo root:

   ```bash
   npm install
   ```

3. Run everything in development mode:

   ```bash
   npm run dev
   ```

   This starts the web app, mobile bundler, and API together via Turborepo.

## Database

We use PostgreSQL with Prisma as the schema/migration tool. Once you have
a Postgres connection string in `apps/api/.env`:

```bash
cd apps/api
npx prisma migrate dev
```

This creates the tables and keeps a migration history you can check into
Git (the SQL itself is safe to commit — only credentials are secret).

## Environments

- **Development** — your machine, a local or free-tier cloud Postgres,
  test payment credentials only.
- **Staging** — a separate Railway/Vercel deployment with its own database,
  used for end-to-end testing before anything goes live.
- **Production** — real domain, real database, real payment credentials.
  Never reuse production credentials anywhere else.

## Branding

Nothing in the app is hardcoded to a final brand name yet. Edit
`packages/shared/src/brand.ts` to change the app name, tagline, or colors
everywhere at once.
