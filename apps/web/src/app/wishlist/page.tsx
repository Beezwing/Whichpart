"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError, apiUrl } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { Alert, Badge, Card } from "../../components/ui";

interface WishlistProduct {
  wishlistId: string;
  id: string;
  name: string;
  price: string;
  condition: string;
  images: { url: string }[];
}
interface WishlistSupplier {
  wishlistId: string;
  id: string;
  tradingName: string;
  verificationStatus: string;
}

export default function WishlistPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<WishlistProduct[]>([]);
  const [suppliers, setSuppliers] = useState<WishlistSupplier[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ products: WishlistProduct[]; suppliers: WishlistSupplier[] }>("/wishlist");
      setProducts(res.products);
      setSuppliers(res.suppliers);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your wishlist.");
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    void load();
  }, [authLoading, user, router, load]);

  async function removeProduct(id: string) {
    await api.delete(`/wishlist/products/${id}`);
    await load();
  }
  async function removeSupplier(id: string) {
    await api.delete(`/wishlist/suppliers/${id}`);
    await load();
  }

  if (authLoading) return null;

  return (
    <main className="mx-auto max-w-3xl flex-1 px-6 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Wishlist</h1>

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <h2 className="mb-3 text-lg font-medium">Saved products</h2>
      {products.length === 0 ? (
        <p className="mb-8 text-sm text-[var(--muted)]">No saved products yet.</p>
      ) : (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {products.map((p) => (
            <Card key={p.wishlistId} className="relative">
              <button
                onClick={() => void removeProduct(p.id)}
                className="absolute right-2 top-2 text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
              <Link href={`/product/${p.id}`}>
                {p.images[0] && (
                  <img
                    src={`${apiUrl}/products/images/${p.images[0].url}/file`}
                    alt=""
                    className="mb-2 h-24 w-full rounded-lg object-cover"
                  />
                )}
                <p className="text-sm font-medium hover:underline">{p.name}</p>
                <p className="text-xs text-[var(--muted)]">{p.condition}</p>
                <p className="mt-1 font-semibold">${Number(p.price).toLocaleString()}</p>
              </Link>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-lg font-medium">Saved suppliers</h2>
      {suppliers.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No saved suppliers yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {suppliers.map((s) => (
            <Card key={s.wishlistId} className="flex items-center justify-between">
              <Link href={`/suppliers/${s.id}`} className="font-medium hover:underline">
                {s.tradingName}
              </Link>
              <div className="flex items-center gap-2">
                {s.verificationStatus === "APPROVED" && <Badge tone="good">Verified</Badge>}
                <button onClick={() => void removeSupplier(s.id)} className="text-xs text-red-600 hover:underline">
                  Remove
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
