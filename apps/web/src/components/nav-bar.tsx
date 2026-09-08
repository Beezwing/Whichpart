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
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-[var(--gold)]"
        >
          <img src="/brand/which-part-icon.png" alt="" className="h-14 w-auto" />
          {brand.shortName}
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/search" data-tour="nav-search" className="text-[var(--muted)] hover:text-[var(--foreground)]">
            Search
          </Link>
          <Link href="/cart" data-tour="nav-cart" className="text-[var(--muted)] hover:text-[var(--foreground)]">
            Cart{itemCount > 0 && ` (${itemCount})`}
          </Link>
          {loading ? null : user ? (
            <>
              {user.role === "CUSTOMER" && (
                <>
                  <Link
                    href="/garage"
                    data-tour="nav-garage"
                    className="text-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    My garage
                  </Link>
                  <Link
                    href="/wishlist"
                    data-tour="nav-wishlist"
                    className="text-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    Wishlist
                  </Link>
                  <Link
                    href="/orders"
                    data-tour="nav-orders"
                    className="text-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    My orders
                  </Link>
                </>
              )}
              <Link
                href={landingPathFor(user.role)}
                data-tour="nav-account"
                className="text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                My account
              </Link>
              <Button
                variant="secondary"
                onClick={() => {
                  void logout().then(() => router.push("/"));
                }}
              >
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-[var(--muted)] hover:text-[var(--foreground)]">
                Log in
              </Link>
              <Link href="/signup">
                <Button>Sign up</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export { landingPathFor };
