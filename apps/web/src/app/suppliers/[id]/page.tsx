"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { Alert, Badge, Button, Card } from "../../../components/ui";

interface Location {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  openingHours: string | null;
  pickupAvailable: boolean;
  deliveryAvailable: boolean;
}
interface SupplierProfile {
  id: string;
  tradingName: string;
  description: string | null;
  phone: string;
  website: string | null;
  verificationStatus: string;
  locations: Location[];
  _count: { products: number };
}
interface ProductResult {
  id: string;
  name: string;
  price: string;
  condition: string;
  sku: string;
}

export default function SupplierProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [supplier, setSupplier] = useState<SupplierProfile | null>(null);
  const [products, setProducts] = useState<ProductResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        api.get<SupplierProfile>(`/marketplace/suppliers/${id}`),
        api.get<{ items: ProductResult[] }>(`/search/products?supplierId=${id}&pageSize=50`),
      ]);
      setSupplier(s);
      setProducts(p.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "This supplier couldn't be found.");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user || user.role !== "CUSTOMER") return;
    void api
      .get<{ suppliers: { id: string }[] }>("/wishlist")
      .then((w) => setSaved(w.suppliers.some((s) => s.id === id)))
      .catch(() => undefined);
  }, [user, id]);

  async function toggleSaved() {
    if (!user || user.role !== "CUSTOMER") return;
    if (saved) await api.delete(`/wishlist/suppliers/${id}`);
    else await api.post(`/wishlist/suppliers/${id}`);
    setSaved(!saved);
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl flex-1 px-6 py-12">
        <Alert variant="error">{error}</Alert>
      </main>
    );
  }
  if (!supplier) {
    return <main className="mx-auto max-w-3xl flex-1 px-6 py-12 text-sm text-[var(--muted)]">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-3xl flex-1 px-6 py-10">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{supplier.tradingName}</h1>
          {supplier.verificationStatus === "APPROVED" && <Badge tone="good">Verified Supplier</Badge>}
        </div>
        {user?.role === "CUSTOMER" && (
          <Button variant="secondary" onClick={() => void toggleSaved()}>
            {saved ? "♥ Saved" : "♡ Save supplier"}
          </Button>
        )}
      </div>

      {supplier.description && <p className="mb-6 text-sm text-[var(--muted)]">{supplier.description}</p>}

      <div className="mb-6 flex flex-wrap gap-4 text-sm text-[var(--muted)]">
        <span>{supplier.phone}</span>
        {supplier.website && (
          <a href={supplier.website} target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">
            {supplier.website}
          </a>
        )}
        <span>{supplier._count.products} products listed</span>
      </div>

      <h2 className="mb-3 text-lg font-medium">Locations</h2>
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {supplier.locations.map((loc) => (
          <Card key={loc.id}>
            <p className="font-medium">{loc.name}</p>
            <p className="text-sm text-[var(--muted)]">{loc.address}</p>
            {loc.phone && <p className="text-sm text-[var(--muted)]">{loc.phone}</p>}
            {loc.openingHours && <p className="text-sm text-[var(--muted)]">{loc.openingHours}</p>}
            <div className="mt-2 flex gap-2 text-xs">
              {loc.pickupAvailable && <span className="rounded-full bg-[var(--border)]/40 px-2 py-0.5">Pickup</span>}
              {loc.deliveryAvailable && <span className="rounded-full bg-[var(--border)]/40 px-2 py-0.5">Delivery</span>}
            </div>
          </Card>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-medium">Products</h2>
      {products.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No active listings yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {products.map((p) => (
            <Link key={p.id} href={`/product/${p.id}`}>
              <Card className="hover:border-[var(--accent)]">
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-[var(--muted)]">{p.condition}</p>
                <p className="mt-1 font-semibold">${Number(p.price).toLocaleString()}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
