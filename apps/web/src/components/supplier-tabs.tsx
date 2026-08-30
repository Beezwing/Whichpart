"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/supplier", label: "Overview" },
  { href: "/supplier/locations", label: "Locations" },
  { href: "/supplier/subscription", label: "Subscription" },
  { href: "/supplier/payment", label: "Payment" },
];

export function SupplierTabs() {
  const pathname = usePathname();
  return (
    <nav className="mb-8 flex gap-1 border-b border-[var(--border)]">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
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
