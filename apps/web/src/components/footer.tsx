import Link from "next/link";
import { brand } from "@autoparts/shared";

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {brand.shortName}
        </p>
        <nav className="flex flex-wrap gap-4">
          <Link href="/terms" className="hover:text-[var(--foreground)]">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-[var(--foreground)]">
            Privacy
          </Link>
          <Link href="/seller-agreement" className="hover:text-[var(--foreground)]">
            Seller agreement
          </Link>
          <Link href="/returns" className="hover:text-[var(--foreground)]">
            Returns
          </Link>
        </nav>
      </div>
    </footer>
  );
}
