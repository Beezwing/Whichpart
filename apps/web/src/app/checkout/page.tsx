"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useCart, type CartItem } from "../../lib/cart";
import { Alert, Button, Card } from "../../components/ui";

interface DeliveryZone {
  name: string;
  fee: number;
  estimatedTime?: string;
}
interface SupplierLocation {
  id: string;
  name: string;
  address: string;
  pickupAvailable: boolean;
  deliveryAvailable: boolean;
  deliveryZones: DeliveryZone[] | null;
}
interface SupplierProfile {
  id: string;
  tradingName: string;
  locations: SupplierLocation[];
}

interface SupplierFulfillment {
  locationId: string;
  deliveryMethod: "PICKUP" | "SUPPLIER_DELIVERY";
  deliveryZoneName: string;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
}

interface OrderResult {
  orderId: string;
  orderNumber: string;
  supplierName: string;
  total: string;
}

export default function CheckoutPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { items, clear } = useCart();

  const [suppliers, setSuppliers] = useState<Record<string, SupplierProfile>>({});
  const [fulfillment, setFulfillment] = useState<Record<string, SupplierFulfillment>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<OrderResult[] | null>(null);

  const supplierIds = [...new Set(items.map((i) => i.supplierId))];

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login?next=/checkout");
      return;
    }
    if (items.length === 0) {
      setLoading(false);
      return;
    }
    void Promise.all(supplierIds.map((id) => api.get<SupplierProfile>(`/marketplace/suppliers/${id}`))).then(
      (profiles) => {
        const map = Object.fromEntries(profiles.map((p) => [p.id, p]));
        setSuppliers(map);
        setFulfillment((prev) => {
          const next = { ...prev };
          for (const p of profiles) {
            if (next[p.id]) continue;
            const firstLocation = p.locations[0];
            next[p.id] = {
              locationId: firstLocation?.id ?? "",
              deliveryMethod: firstLocation?.pickupAvailable ? "PICKUP" : "SUPPLIER_DELIVERY",
              deliveryZoneName: "",
              recipientName: "",
              recipientPhone: "",
              deliveryAddress: "",
            };
          }
          return next;
        });
        setLoading(false);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, router]);

  function updateFulfillment(supplierId: string, patch: Partial<SupplierFulfillment>) {
    setFulfillment((prev) => ({ ...prev, [supplierId]: { ...prev[supplierId], ...patch } }));
  }

  function itemsFor(supplierId: string): CartItem[] {
    return items.filter((i) => i.supplierId === supplierId);
  }

  function estimatedTotal(supplierId: string): number {
    const subtotal = itemsFor(supplierId).reduce((sum, i) => sum + i.price * i.quantity, 0);
    const f = fulfillment[supplierId];
    const location = suppliers[supplierId]?.locations.find((l) => l.id === f?.locationId);
    const zone = location?.deliveryZones?.find((z) => z.name === f?.deliveryZoneName);
    const deliveryFee = f?.deliveryMethod === "SUPPLIER_DELIVERY" ? (zone?.fee ?? 0) : 0;
    return subtotal + deliveryFee;
  }

  async function submitOrder() {
    setError(null);
    setSubmitting(true);
    try {
      const body = {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        supplierFulfillment: supplierIds.map((supplierId) => {
          const f = fulfillment[supplierId];
          return {
            supplierId,
            locationId: f.locationId,
            deliveryMethod: f.deliveryMethod,
            deliveryZoneName: f.deliveryMethod === "SUPPLIER_DELIVERY" ? f.deliveryZoneName || undefined : undefined,
            recipientName: f.recipientName || undefined,
            recipientPhone: f.recipientPhone || undefined,
            deliveryAddress: f.deliveryAddress || undefined,
          };
        }),
      };
      const created = await api.post<OrderResult[]>("/checkout", body);
      setResults(created);
      clear();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't complete checkout. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading) {
    return <main className="mx-auto max-w-2xl flex-1 px-6 py-12 text-sm text-[var(--muted)]">Loading…</main>;
  }

  if (results) {
    return (
      <main className="mx-auto max-w-2xl flex-1 px-6 py-12">
        <h1 className="mb-4 text-2xl font-semibold">Orders placed</h1>
        <Alert variant="success">
          Your order{results.length > 1 ? "s have" : " has"} been created and reserved. Real payment collection
          isn&apos;t wired up yet — you&apos;ll be prompted to pay each supplier once that&apos;s ready.
        </Alert>
        <div className="mt-6 flex flex-col gap-3">
          {results.map((r) => (
            <Card key={r.orderId} className="flex items-center justify-between">
              <div>
                <p className="font-medium">{r.supplierName}</p>
                <p className="text-xs text-[var(--muted)]">Order {r.orderNumber}</p>
              </div>
              <p className="font-semibold">${Number(r.total).toLocaleString()}</p>
            </Card>
          ))}
        </div>
        <Link href="/orders" className="mt-6 inline-block">
          <Button>View my orders</Button>
        </Link>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-2xl flex-1 px-6 py-12 text-center">
        <h1 className="mb-4 text-2xl font-semibold">Your cart is empty</h1>
        <Link href="/search">
          <Button>Search for parts</Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Checkout</h1>

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {supplierIds.map((supplierId) => {
          const supplier = suppliers[supplierId];
          const f = fulfillment[supplierId];
          if (!supplier || !f) return null;
          const location = supplier.locations.find((l) => l.id === f.locationId);

          return (
            <Card key={supplierId}>
              <p className="mb-3 font-medium">{supplier.tradingName}</p>
              <ul className="mb-4 flex flex-col gap-1 text-sm text-[var(--muted)]">
                {itemsFor(supplierId).map((i) => (
                  <li key={i.productId}>
                    {i.quantity} × {i.name}
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-3">
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Location</span>
                  <select
                    value={f.locationId}
                    onChange={(e) => updateFulfillment(supplierId, { locationId: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                  >
                    {supplier.locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} — {l.address}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex gap-4 text-sm">
                  {location?.pickupAvailable && (
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        checked={f.deliveryMethod === "PICKUP"}
                        onChange={() => updateFulfillment(supplierId, { deliveryMethod: "PICKUP" })}
                      />
                      Pickup
                    </label>
                  )}
                  {location?.deliveryAvailable && (
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        checked={f.deliveryMethod === "SUPPLIER_DELIVERY"}
                        onChange={() => updateFulfillment(supplierId, { deliveryMethod: "SUPPLIER_DELIVERY" })}
                      />
                      Delivery
                    </label>
                  )}
                </div>

                {f.deliveryMethod === "SUPPLIER_DELIVERY" && (
                  <>
                    <select
                      value={f.deliveryZoneName}
                      onChange={(e) => updateFulfillment(supplierId, { deliveryZoneName: e.target.value })}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                    >
                      <option value="">Select a delivery zone</option>
                      {(location?.deliveryZones ?? []).map((z) => (
                        <option key={z.name} value={z.name}>
                          {z.name} — ${z.fee.toLocaleString()}
                        </option>
                      ))}
                    </select>
                    <input
                      placeholder="Recipient name"
                      value={f.recipientName}
                      onChange={(e) => updateFulfillment(supplierId, { recipientName: e.target.value })}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                    />
                    <input
                      placeholder="Recipient phone"
                      value={f.recipientPhone}
                      onChange={(e) => updateFulfillment(supplierId, { recipientPhone: e.target.value })}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                    />
                    <input
                      placeholder="Delivery address"
                      value={f.deliveryAddress}
                      onChange={(e) => updateFulfillment(supplierId, { deliveryAddress: e.target.value })}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                    />
                  </>
                )}
              </div>

              <p className="mt-4 text-right text-sm font-semibold">
                Estimated total: ${estimatedTotal(supplierId).toLocaleString()}
              </p>
            </Card>
          );
        })}
      </div>

      <div className="mt-6">
        <Button disabled={submitting} onClick={() => void submitOrder()}>
          {submitting ? "Placing order…" : "Place order"}
        </Button>
        <p className="mt-2 text-xs text-[var(--muted)]">
          This reserves your items and creates your order — actual payment collection isn&apos;t connected yet.
        </p>
      </div>
    </main>
  );
}
