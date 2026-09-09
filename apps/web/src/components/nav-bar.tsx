"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { brand } from "@autoparts/shared";
import { useAuth } from "../lib/auth-context";
import { useCart } from "../lib/cart";
import { Button } from "./ui";

function landingPathFor(role: string): string {
  if (role === "ADMIN" || role === "SUPER_ADMIN") return "/admin/suppliers";
  if (role === "SUPPLIER_OWNER" || role === "SUPPLIER_STAFF" || role === "SUPPLIER_LOCATION_MANAGER")
    return "/supplier";
  return "/account";
}

export function NavBar() {
  const { user, loading, logout } = useAuth();
  const { itemCount } = useCart();
  const router = useRouter();

  return (
    <header className="brand-header border-b border-[var(--border)]">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:px-6 sm:py-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-lg font-extrabold tracking-tight text-[var(--gold)] sm:text-2xl"
        >
          <img src="/brand/which-part-icon.png" alt="" className="h-10 w-auto sm:h-14" />
          <span className="whitespace-nowrap">{brand.shortName}</span>
        </Link>
        {/* min-w-0 lets this shrink below its content's natural width so it
            scrolls internally instead of forcing the header (and the whole
            page) wider than the viewport -- the actual cause of a real
            horizontal-scroll bug this replaced. Nothing here is ever
            display:none, so the guided tour's getBoundingClientRect/
            scrollIntoView still finds every target on a narrow screen too. */}
        <nav className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto text-sm [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1">
          <Link
            href="/search"
            data-tour="nav-search"
            className="shrink-0 whitespace-nowrap text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Search
          </Link>
          <Link
            href="/cart"
            data-tour="nav-cart"
            className="shrink-0 whitespace-nowrap text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Cart{itemCount > 0 && ` (${itemCount})`}
          </Link>
          {loading ? null : user ? (
            <>
              {user.role === "CUSTOMER" && (
                <>
                  <Link
                    href="/garage"
                    data-tour="nav-garage"
                    className="shrink-0 whitespace-nowrap text-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    My garage
                  </Link>
                  <Link
                    href="/wishlist"
                    data-tour="nav-wishlist"
                    className="shrink-0 whitespace-nowrap text-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    Wishlist
                  </Link>
                  <Link
                    href="/orders"
                    data-tour="nav-orders"
                    className="shrink-0 whitespace-nowrap text-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    My orders
                  </Link>
                </>
              )}
              <Link
                href={landingPathFor(user.role)}
                data-tour="nav-account"
                className="shrink-0 whitespace-nowrap text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                My account
              </Link>
              <Button
                variant="secondary"
                className="shrink-0 whitespace-nowrap"
                onClick={() => {
                  void logout().then(() => router.push("/"));
                }}
              >
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="shrink-0 whitespace-nowrap text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                Log in
              </Link>
              <Link href="/signup" className="shrink-0">
                <Button className="whitespace-nowrap">Sign up</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export { landingPathFor };
