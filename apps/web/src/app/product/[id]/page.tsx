"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError, apiUrl } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { useCart } from "../../../lib/cart";
import { Alert, Badge, Button, Card } from "../../../components/ui";

interface ProductImage {
  id: string;
  url: string;
}
interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  condition: string;
  price: string;
  currency: string;
  oemPartNumber: string | null;
  manufacturerPartNumber: string | null;
  category: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
  images: ProductImage[];
  compatibilities: { yearFrom: number | null; yearTo: number | null; notes: string | null }[];
  inventory: {
    quantity: number;
    location: { id: string; name: string; pickupAvailable: boolean; deliveryAvailable: boolean };
  }[];
  supplier: { id: string; tradingName: string; verificationStatus: string; physicalAddress: string };
}

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [wishlisted, setWishlisted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setProduct(await api.get<Product>(`/marketplace/products/${id}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "This part couldn't be found.");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user || user.role !== "CUSTOMER") return;
    void api
      .get<{ products: { id: string }[] }>("/wishlist")
      .then((w) => setWishlisted(w.products.some((p) => p.id === id)))
      .catch(() => undefined);
  }, [user, id]);

  async function toggleWishlist() {
    if (!user || user.role !== "CUSTOMER") {
      setMessage("Log in as a customer to save items to your wishlist.");
      return;
    }
    try {
      if (wishlisted) await api.delete(`/wishlist/products/${id}`);
      else await api.post(`/wishlist/products/${id}`);
      setWishlisted(!wishlisted);
    } catch {
      setMessage("Couldn't update your wishlist.");
    }
  }

  function addToCart() {
    if (!product) return;
    addItem({
      productId: product.id,
      supplierId: product.supplier.id,
      supplierName: product.supplier.tradingName,
      name: product.name,
      sku: product.sku,
      price: Number(product.price),
      imageUrl: product.images[0]?.url ?? null,
    });
    setMessage("Added to cart.");
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl flex-1 px-6 py-12">
        <Alert variant="error">{error}</Alert>
      </main>
    );
  }
  if (!product) {
    return <main className="mx-auto max-w-3xl flex-1 px-6 py-12 text-sm text-[var(--muted)]">Loading…</main>;
  }

  const totalQuantity = product.inventory.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-10">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <div className="mb-3 aspect-square overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            {product.images.length > 0 ? (
              <img
                src={`${apiUrl}/products/images/${product.images[activeImage].url}/file`}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
                No photo provided
              </div>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-2">
              {product.images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImage(i)}
                  className={`h-16 w-16 overflow-hidden rounded-lg border ${
                    i === activeImage ? "border-[var(--accent)]" : "border-[var(--border)]"
                  }`}
                >
                  <img src={`${apiUrl}/products/images/${img.url}/file`} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-semibold">{product.name}</h1>
          <p className="mb-3 text-sm text-[var(--muted)]">
            {product.condition} · SKU {product.sku}
            {product.category && ` · ${product.category.name}`}
            {product.brand && ` · ${product.brand.name}`}
          </p>
          <p className="mb-4 text-3xl font-semibold">
            ${Number(product.price).toLocaleString()} <span className="text-sm font-normal">{product.currency}</span>
          </p>

          {message && (
            <div className="mb-3">
              <Alert variant="info">{message}</Alert>
            </div>
          )}

          <div className="mb-6 flex gap-2">
            <Button disabled={totalQuantity === 0} onClick={addToCart}>
              {totalQuantity === 0 ? "Out of stock" : "Add to cart"}
            </Button>
            <Button variant="secondary" onClick={() => void toggleWishlist()}>
              {wishlisted ? "♥ Saved" : "♡ Save"}
            </Button>
          </div>

          <Card className="mb-4">
            <Link href={`/suppliers/${product.supplier.id}`} className="font-medium hover:underline">
              {product.supplier.tradingName}
            </Link>
            {product.supplier.verificationStatus === "APPROVED" && (
              <Badge tone="good"> Verified Supplier</Badge>
            )}
            <p className="mt-1 text-xs text-[var(--muted)]">{product.supplier.physicalAddress}</p>
          </Card>

          <Card className="mb-4">
            <p className="mb-2 text-sm font-medium">Availability</p>
            {product.inventory.length === 0 && <p className="text-sm text-[var(--muted)]">No stock information.</p>}
            {product.inventory.map((inv) => (
              <p key={inv.location.id} className="text-sm text-[var(--muted)]">
                {inv.location.name}: {inv.quantity > 0 ? `${inv.quantity} available` : "Out of stock"}
                {inv.location.pickupAvailable && " · Pickup"}
                {inv.location.deliveryAvailable && " · Delivery"}
              </p>
            ))}
          </Card>

          {(product.oemPartNumber || product.manufacturerPartNumber) && (
            <Card className="mb-4 text-sm">
              {product.oemPartNumber && <p>OEM part number: {product.oemPartNumber}</p>}
              {product.manufacturerPartNumber && <p>Manufacturer part number: {product.manufacturerPartNumber}</p>}
            </Card>
          )}

          {product.compatibilities.length > 0 && (
            <Card className="mb-4 text-sm">
              <p className="mb-1 font-medium">Vehicle compatibility</p>
              {product.compatibilities.map((c, i) => (
                <p key={i} className="text-[var(--muted)]">
                  {[c.yearFrom && c.yearTo && `${c.yearFrom}–${c.yearTo}`, c.notes].filter(Boolean).join(" — ")}
                </p>
              ))}
            </Card>
          )}

          {product.description && (
            <Card>
              <p className="text-sm text-[var(--muted)]">{product.description}</p>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
