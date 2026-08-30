# Contributing

This is currently a single-owner project in early foundation. These are
the working conventions so the codebase stays consistent as it grows.

- **One rule, one place.** Validation rules live in `packages/shared` as
  Zod schemas and are imported by the API, web, and mobile apps — never
  re-implement a rule in more than one place.
- **The API is the only source of truth.** Neither frontend talks to the
  database directly or trusts a price/quantity/total it received from the
  client without the backend recalculating it server-side.
- **Money and inventory changes go through a service, not a raw Prisma
  call in a controller** — this is where business rules (Section 85 in
  the architecture report) get enforced.
- **Every sensitive admin/supplier action writes an audit log row** via
  `AuditLogService`, not just a database update.
- **Never commit a `.env` file.** Each app's `.env.example` documents
  what it needs.
- **Branding lives in one file** — `packages/shared/src/brand.ts`.

## Commit style

Short, present-tense, describes the "why" when it isn't obvious from the
diff (e.g. `feat: supplier verification state machine`, not
`update files`).
