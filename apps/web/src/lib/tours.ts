import type { TourStep } from "../components/product-tour";

// Ids must match TOUR_IDS in @autoparts/shared -- kept as plain literals
// here (not imported) so this file has zero dependency on the schema
// package beyond the type-check that TourId below enforces.
export const CUSTOMER_TOUR_ID = "customer-v1" as const;
export const SUPPLIER_TOUR_ID = "supplier-v1" as const;

/**
 * The server is the source of truth for "seen" (POST /auth/tours/:id/seen,
 * reflected back on user.toursSeen), but that round trip can be behind an
 * API deploy that hasn't shipped yet, or can just fail. localStorage is a
 * same-device fallback so dismissing a tour sticks across reloads even
 * then -- it's checked in addition to, never instead of, the server flag.
 */
function localTourKey(tourId: string): string {
  return `autoparts:tour-seen:${tourId}`;
}

export function hasSeenTourLocally(tourId: string): boolean {
  try {
    return localStorage.getItem(localTourKey(tourId)) === "1";
  } catch {
    return false;
  }
}

export function markTourSeenLocally(tourId: string): void {
  try {
    localStorage.setItem(localTourKey(tourId), "1");
  } catch {
    /* private browsing / storage disabled -- server flag is still tried */
  }
}

export const CUSTOMER_TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="nav-search"]',
    title: "Search for parts",
    body: "Look up parts by name, part number, or filter by your vehicle's make, model, and year.",
  },
  {
    selector: '[data-tour="nav-cart"]',
    title: "Your cart",
    body: "Items you've added sit here, grouped by supplier, until you check out.",
  },
  {
    selector: '[data-tour="nav-garage"]',
    title: "My garage",
    body: "Save your vehicles here so search can show you what actually fits, without re-entering it every time.",
  },
  {
    selector: '[data-tour="nav-wishlist"]',
    title: "Wishlist",
    body: "Save parts you're not ready to buy yet.",
  },
  {
    selector: '[data-tour="nav-orders"]',
    title: "My orders",
    body: "Every order you've placed, from any supplier, and its status.",
  },
  {
    selector: '[data-tour="nav-account"]',
    title: "My account",
    body: "Your profile and password. You can replay this tour from here anytime.",
  },
];

export const SUPPLIER_TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="tab-overview"]',
    title: "Overview",
    body: "Your business profile, verification status, and recent notifications.",
  },
  {
    selector: '[data-tour="tab-products"]',
    title: "Products",
    body: "Add products one at a time, or upload a spreadsheet to add many at once.",
  },
  {
    selector: '[data-tour="tab-orders"]',
    title: "Orders",
    body: "Every order a customer places lands here — update its status as you fulfill it.",
  },
  {
    selector: '[data-tour="tab-locations"]',
    title: "Locations",
    body: "Set up where customers can pick up, and what you charge for delivery to each area.",
  },
  {
    selector: '[data-tour="tab-subscription"]',
    title: "Subscription",
    body: "Manage your marketplace plan.",
  },
  {
    selector: '[data-tour="tab-payment"]',
    title: "Payment",
    body: "Connect LuniPay, Fygaro, or DimePay — this is how customer payments actually reach you.",
  },
];
