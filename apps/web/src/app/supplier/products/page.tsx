"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { Alert, Badge, Button, Card, Input } from "../../../components/ui";
import { SupplierTabs } from "../../../components/supplier-tabs";

interface InventoryRow {
  quantity: number;
  lowStockThreshold: number | null;
  location: { name: string };
}
interface ProductRow {
  id: string;
  sku: string;
  name: string;
  price: string;
  condition: string;
  isActive: boolean;
  inventory: InventoryRow[];
}

const FILTERS = [
  { label: "All", value: "" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Low stock", value: "lowStock" },
];

export default function SupplierProductsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (f: string, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (f === "active") params.set("isActive", "true");
      if (f === "inactive") params.set("isActive", "false");
      if (f === "lowStock") params.set("lowStock", "true");
      if (q) params.set("search", q);
      const rows = await api.get<ProductRow[]>(`/suppliers/me/products?${params.toString()}`);
      setProducts(rows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your products.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    void load(filter, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, router, filter]);

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-12">
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <div className="flex gap-2">
          <Link href="/supplier/products/bulk-upload">
            <Button variant="secondary">Bulk upload</Button>
          </Link>
          <Link href="/supplier/products/new">
            <Button>+ New product</Button>
          </Link>
        </div>
      </div>
      <SupplierTabs />

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full border px-3 py-1 text-sm ${
                filter === f.value
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "border-[var(--border)] text-[var(--muted)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <form
          className="flex w-full gap-2 sm:ml-auto sm:w-auto"
          onSubmit={(e) => {
            e.preventDefault();
            void load(filter, search);
          }}
        >
          <Input
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-48"
          />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : products.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">
            No products yet. Add one manually or use the bulk upload template.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {products.map((p) => {
            const totalQty = p.inventory.reduce((sum, i) => sum + i.quantity, 0);
            const isLow = p.inventory.some((i) => i.lowStockThreshold != null && i.quantity <= i.lowStockThreshold);
            return (
              <Link key={p.id} href={`/supplier/products/${p.id}`}>
                <Card className="flex flex-col gap-2 hover:border-[var(--accent)] sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      SKU {p.sku} · {p.condition}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span>${Number(p.price).toLocaleString()} JMD</span>
                    <span className="text-[var(--muted)]">{totalQty} in stock</span>
                    {isLow && <Badge tone="warn">Low stock</Badge>}
                    {!p.isActive && <Badge tone="neutral">Inactive</Badge>}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
