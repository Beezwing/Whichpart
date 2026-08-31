"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { brand } from "@autoparts/shared";
import { useAuth } from "../lib/auth-context";
import { Button } from "./ui";

function landingPathFor(role: string): string {
  if (role === "ADMIN" || role === "SUPER_ADMIN") return "/admin/suppliers";
  if (role === "SUPPLIER_OWNER" || role === "SUPPLIER_STAFF" || role === "SUPPLIER_LOCATION_MANAGER")
    return "/supplier";
  return "/account";
}

export function NavBar() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  return (
    <header className="border-b border-[var(--border)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold">
          {brand.shortName}
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/search" className="text-[var(--muted)] hover:text-[var(--foreground)]">
            Search
          </Link>
          {loading ? null : user ? (
            <>
              {user.role === "CUSTOMER" && (
                <Link href="/garage" className="text-[var(--muted)] hover:text-[var(--foreground)]">
                  My garage
                </Link>
              )}
              <Link href={landingPathFor(user.role)} className="text-[var(--muted)] hover:text-[var(--foreground)]">
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
