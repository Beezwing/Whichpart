"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { brand } from "@autoparts/shared";
import { api, apiUrl } from "../lib/api";
import { Button, Card, Input } from "../components/ui";
import type { CategoryNode } from "../lib/categories";

interface RecentProduct {
  id: string;
  name: string;
  price: string;
  condition: string;
  imageUrl: string | null;
  supplier: { tradingName: string };
}

export default function Home() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [recent, setRecent] = useState<RecentProduct[]>([]);

  useEffect(() => {
    void api.get<CategoryNode[]>("/categories").then((c) => setCategories(c.slice(0, 8)));
    void api
      .get<{ items: RecentProduct[] }>("/search/products?sort=relevance&pageSize=8")
      .then((r) => setRecent(r.items));
  }, []);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/search${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  }

  return (
    <main className="flex-1">
      <section className="flex flex-col items-center gap-6 px-6 py-16 text-center">
        <img
          src="/brand/which-part-flat.png"
          alt={brand.appName}
          className="h-40 w-40 sm:h-48 sm:w-48 logo-light-only"
        />
        <img
          src="/brand/which-part-badge.png"
          alt={brand.appName}
          className="h-40 w-40 rounded-2xl sm:h-48 sm:w-48 logo-dark-only"
        />
        <p className="max-w-md text-[var(--muted)]">{brand.tagline}</p>
        <form onSubmit={onSearch} className="flex w-full max-w-lg gap-2">
          <Input
            placeholder="Part name, OEM number, SKU, chassis number…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button type="submit">Search</Button>
        </form>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/signup">
            <Button variant="secondary">Create a customer account</Button>
          </Link>
          <Link href="/become-a-supplier">
            <Button variant="secondary">Become a supplier</Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium">Browse by category</h2>
          <Link href="/categories" className="text-sm text-[var(--accent)] hover:underline">
            All categories →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {categories.map((c) => (
            <Link key={c.id} href={`/search?categoryId=${c.id}`}>
              <Card className="text-center hover:border-[var(--accent)]">
                <p className="text-sm font-medium">{c.name}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 pb-20">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium">Recently listed</h2>
            <Link href="/search" className="text-sm text-[var(--accent)] hover:underline">
              See all →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {recent.map((p) => (
              <Link key={p.id} href={`/product/${p.id}`}>
                <Card className="hover:border-[var(--accent)]">
                  {p.imageUrl && (
                    <img
                      src={`${apiUrl}/products/images/${p.imageUrl}/file`}
                      alt=""
                      className="mb-2 h-24 w-full rounded-lg object-cover"
                    />
                  )}
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-[var(--muted)]">{p.supplier.tradingName}</p>
                  <p className="mt-1 font-semibold">${Number(p.price).toLocaleString()}</p>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
