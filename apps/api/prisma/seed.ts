/**
 * One-time setup, safe to re-run:
 * 1. Creates the first Super Admin account (Rule 9 — admins are never
 *    self-registered; this is the only way one gets created).
 * 2. Seeds the two default subscription plans from Section 2 of the
 *    master spec (Monthly $299 / Annual $2,990, 30-day trial). Pricing
 *    stays admin-editable from here — this just gives the admin panel
 *    something to edit instead of starting with an empty table.
 *
 * Run with: npm run db:seed --workspace=api
 * Requires ADMIN_EMAIL and ADMIN_PASSWORD in apps/api/.env.
 */
import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function seedAdmin() {
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

async function seedSubscriptionPlans() {
  const existing = await prisma.subscriptionPlan.count();
  if (existing > 0) {
    console.log("Subscription plans already exist — nothing to do.");
    return;
  }

  await prisma.subscriptionPlan.createMany({
    data: [
      { name: "Monthly", billingPeriod: "MONTHLY", priceUsd: 299, trialDays: 30 },
      { name: "Annual", billingPeriod: "ANNUAL", priceUsd: 2990, trialDays: 30 },
    ],
  });
  console.log("Created default subscription plans (Monthly $299, Annual $2,990).");
}

const CATEGORY_TREE: Record<string, string[]> = {
  "Engine & Drivetrain": ["Engines", "Engine Components", "Transmissions", "Transmission Components", "Drivetrain"],
  "Service Parts": [
    "Oil Filters",
    "Air Filters",
    "Fuel Filters",
    "Spark Plugs",
    "Belts",
    "Fluids",
    "Wipers",
    "Service Kits",
    "Other Service Parts",
  ],
  Braking: ["Brake Pads", "Brake Rotors", "Calipers", "Brake Lines", "Brake Components"],
  Electrical: ["Batteries", "Alternators", "Starters", "Sensors", "ECUs", "Wiring", "Electrical Components"],
  "Suspension & Steering": [],
  "Cooling System": [],
  "Body Parts": [],
  Lighting: [],
  Interior: [],
  "Wheels & Tires": [],
  Accessories: [],
  "Audio & Electronics": [],
  "Tools & Equipment": [],
  "Used Parts": [],
};

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Admin can still add/edit/reorganize freely (Section 16) — this just seeds a starting point. */
async function seedCategories() {
  const existing = await prisma.category.count();
  if (existing > 0) {
    console.log("Categories already exist — nothing to do.");
    return;
  }

  for (const [parentName, children] of Object.entries(CATEGORY_TREE)) {
    const parent = await prisma.category.create({
      data: { name: parentName, slug: slugify(parentName) },
    });
    for (const childName of children) {
      await prisma.category.create({
        data: { name: childName, slug: slugify(`${parentName}-${childName}`), parentId: parent.id },
      });
    }
  }
  console.log(`Created ${Object.keys(CATEGORY_TREE).length} top-level categories.`);
}

async function main() {
  await seedAdmin();
  await seedSubscriptionPlans();
  await seedCategories();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
