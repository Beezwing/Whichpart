"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/supplier", label: "Overview", tour: "tab-overview" },
  { href: "/supplier/products", label: "Products", tour: "tab-products" },
  { href: "/supplier/orders", label: "Orders", tour: "tab-orders" },
  { href: "/supplier/locations", label: "Locations", tour: "tab-locations" },
  { href: "/supplier/subscription", label: "Subscription", tour: "tab-subscription" },
  { href: "/supplier/payment", label: "Payment", tour: "tab-payment" },
];

export function SupplierTabs() {
  const pathname = usePathname();
  return (
    // overflow-x-auto + shrink-0/whitespace-nowrap on each tab: on a narrow
    // screen this scrolls horizontally instead of clipping the later tabs
    // off-screen with no way to reach them (Payment was unreachable on
    // mobile before this).
    <nav className="mb-8 flex gap-1 overflow-x-auto border-b border-[var(--border)] [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1">
      {TABS.map((tab) => {
        const active = tab.href === "/supplier" ? pathname === tab.href : pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            data-tour={tab.tour}
            className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
              active
                ? "border-[var(--accent)] font-medium text-[var(--foreground)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
