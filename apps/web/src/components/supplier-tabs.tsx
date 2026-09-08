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
    <nav className="mb-8 flex gap-1 border-b border-[var(--border)]">
      {TABS.map((tab) => {
        const active = tab.href === "/supplier" ? pathname === tab.href : pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            data-tour={tab.tour}
            className={`border-b-2 px-3 py-2 text-sm ${
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
