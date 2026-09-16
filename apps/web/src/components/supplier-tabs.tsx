"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const TABS = [
  { href: "/supplier", label: "Overview", tour: "tab-overview" },
  { href: "/supplier/products", label: "Products", tour: "tab-products" },
  { href: "/supplier/orders", label: "Orders", tour: "tab-orders" },
  { href: "/supplier/locations", label: "Locations", tour: "tab-locations" },
  { href: "/supplier/subscription", label: "Subscription", tour: "tab-subscription" },
  { href: "/supplier/payment", label: "Payment", tour: "tab-payment" },
  { href: "/supplier/quickbooks", label: "QuickBooks", tour: "tab-quickbooks" },
];

export function SupplierTabs() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Same fade-hint pattern as the top nav bar (nav-bar.tsx) -- a scrollable
  // strip with no scrollbar and no other visual cue left "Payment" (and now
  // "QuickBooks") reachable only by an undiscoverable horizontal swipe on
  // narrow screens.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const update = () => {
      setCanScrollLeft(el.scrollLeft > 1);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    };
    update();
    el.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="relative mb-8">
      {/* overflow-x-auto + shrink-0/whitespace-nowrap on each tab: on a
          narrow screen this scrolls horizontally instead of clipping later
          tabs off-screen with no way to reach them. */}
      <nav
        ref={navRef}
        className="flex gap-1 overflow-x-auto border-b border-[var(--border)] [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1"
      >
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
      {canScrollLeft && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 bottom-[1px] left-0 w-6 bg-gradient-to-r from-[var(--background)] to-transparent"
        />
      )}
      {canScrollRight && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 bottom-[1px] right-0 w-6 bg-gradient-to-l from-[var(--background)] to-transparent"
        />
      )}
    </div>
  );
}
