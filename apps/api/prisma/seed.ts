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
      { name: "Monthly", billingPeriod: "MONTHLY", price: 10000, currency: "JMD", commissionRate: 0.05, trialDays: 30 },
      { name: "Annual", billingPeriod: "ANNUAL", price: 100000, currency: "JMD", commissionRate: 0.05, trialDays: 30 },
    ],
  });
  console.log("Created default subscription plans (Monthly $10,000 JMD, Annual $100,000 JMD, 5% commission).");
}

const CATEGORY_TREE: Record<string, string[]> = {
  "Engines & Engine Components": [
    "Engines",
    "Engine Components",
    "Engine Blocks",
    "Cylinder Heads",
    "Pistons & Rings",
    "Camshafts & Crankshafts",
    "Engine Gaskets",
    "Timing Belts & Chains",
    "Engine Mounts",
    "Fuel Injection Components",
    "Turbochargers & Superchargers",
  ],
  "Transmission & Drivetrain": [
    "Transmissions",
    "Transmission Components",
    "Drivetrain",
    "Clutches & Pressure Plates",
    "CV Joints & Axles",
    "Differentials",
    "Transfer Cases",
  ],
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
  "Suspension & Steering": [
    "Shock Absorbers & Struts",
    "Control Arms",
    "Ball Joints",
    "Tie Rods",
    "Steering Racks",
    "Power Steering Pumps",
    "Springs & Coils",
    "Bushings",
    "Sway Bars",
  ],
  "Braking System": [
    "Brake Pads",
    "Brake Rotors",
    "Calipers",
    "Brake Lines",
    "Brake Components",
    "Brake Drums & Shoes",
    "Master Cylinders",
    "ABS Components",
  ],
  "Lighting & Bulbs": [
    "Headlights",
    "Tail Lights",
    "Fog Lights",
    "Turn Signal Lights",
    "Interior Lights",
    "Bulbs",
    "Light Assemblies & Housings",
  ],
  "Body Parts": ["Bumpers", "Fenders", "Hoods", "Doors", "Mirrors", "Grilles", "Windshields & Glass", "Body Trim & Moldings"],
  "Interior Parts": [
    "Seats & Upholstery",
    "Dashboard & Trim",
    "Door Panels",
    "Carpets & Floor Mats",
    "Steering Wheels & Airbags",
    "Interior Accessories",
  ],
  "Audio & Electronics": [
    "Stereos & Head Units",
    "Speakers",
    "Amplifiers",
    "Dash Cams",
    "Navigation Systems",
    "Infotainment Components",
  ],
  "Electrical & Charging": [
    "Batteries",
    "Alternators",
    "Starters",
    "Sensors",
    "ECUs",
    "Wiring",
    "Electrical Components",
    "Fuses & Relays",
    "Ignition Components",
  ],
  "AC & Climate Control": [
    "AC Compressors",
    "Condensers",
    "Evaporators",
    "Blower Motors",
    "Heater Cores",
    "AC Hoses & Lines",
    "Climate Control Units",
  ],
  "Cooling System": [
    "Radiators",
    "Water Pumps",
    "Thermostats",
    "Cooling Fans",
    "Radiator Hoses",
    "Coolant Reservoirs",
    "Hoses & Seals",
  ],
  "Wheels & Tires": ["Tires", "Rims & Wheels", "Wheel Bearings", "Hub Caps", "TPMS Sensors", "Lug Nuts"],
  Accessories: [
    "Floor Mats & Liners",
    "Seat Covers",
    "Roof Racks & Carriers",
    "Tow Hooks & Hitches",
    "Car Care Products",
    "Phone Mounts & Chargers",
  ],
  "Tools & Equipment": ["Diagnostic Tools", "Jacks & Lifts", "Hand Tools", "Shop Supplies"],
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

// A real, well-known starting list for Jamaica's used-import market —
// not exhaustive, and admin can add/edit freely from here (Section 18).
const VEHICLE_TREE: Record<string, string[]> = {
  Toyota: ["Corolla", "Axio", "Fielder", "Premio", "Vitz", "Yaris", "RAV4", "Hilux", "Avensis"],
  Honda: ["Civic", "Fit", "Accord", "CR-V", "Vezel"],
  Nissan: ["Sunny", "Almera", "Note", "Tiida", "X-Trail", "Wingroad"],
  Mazda: ["Demio", "Axela", "CX-5", "Familia"],
  Suzuki: ["Swift", "Vitara", "Alto"],
  Mitsubishi: ["Lancer", "Outlander", "Mirage"],
  Hyundai: ["Elantra", "Tucson", "Accent"],
  Kia: ["Rio", "Sportage", "Picanto"],
};

/** Admin can add/edit/reorganize freely from here (Section 18). */
async function seedVehicles() {
  const existing = await prisma.make.count();
  if (existing > 0) {
    console.log("Vehicle makes already exist — nothing to do.");
    return;
  }

  for (const [makeName, models] of Object.entries(VEHICLE_TREE)) {
    const make = await prisma.make.create({ data: { name: makeName } });
    for (const modelName of models) {
      await prisma.model.create({ data: { makeId: make.id, name: modelName } });
    }
  }
  console.log(`Created ${Object.keys(VEHICLE_TREE).length} vehicle makes with their common models.`);
}

async function main() {
  await seedAdmin();
  await seedSubscriptionPlans();
  await seedCategories();
  await seedVehicles();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
