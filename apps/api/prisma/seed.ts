/**
 * Creates the first Super Admin account. Admin accounts are never
 * self-registered (Rule 9 / Section 44) — this is the only way one gets
 * created. Safe to run more than once: it does nothing if the account
 * already exists.
 *
 * Run with: npm run db:seed --workspace=api
 * Requires ADMIN_EMAIL and ADMIN_PASSWORD in apps/api/.env.
 */
import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Set ADMIN_EMAIL and ADMIN_PASSWORD in apps/api/.env before seeding the admin account.",
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin account for ${email} already exists — nothing to do.`);
    return;
  }

  const passwordHash = await argon2.hash(password);
  await prisma.user.create({
    data: { email, passwordHash, role: "SUPER_ADMIN" },
  });
  console.log(`Created Super Admin account for ${email}.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
