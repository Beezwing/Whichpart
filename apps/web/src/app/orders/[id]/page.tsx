"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { Alert, Badge, Button, Card } from "../../../components/ui";

interface OrderItem {
  id: string;
  nameSnapshot: string;
  skuSnapshot: string;
  priceAtPurchase: string;
  quantity: number;
}
interface Payment {
  id: string;
  provider: string;
  amount: string;
  status: string;
}
const STATUS_TONE: Record<string, "neutral" | "good" | "warn" | "bad"> = {
  AWAITING_PAYMENT: "warn",
  PAID: "good",
  PROCESSING: "good",
  READY_FOR_PICKUP: "good",
  OUT_FOR_DELIVERY: "good",
  DELIVERED: "good",
  COMPLETED: "good",
  CANCELLED: "neutral",
  REFUNDED: "neutral",
  DISPUTED: "bad",
};

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  subtotal: string;
  deliveryFee: string;
  total: string;
  deliveryProvider: string;
  deliveryAddress: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  createdAt: string;
  paymentExpiresAt: string | null;
  supplier: { id: string; tradingName: string };
  location: { name: string; address: string };
  items: OrderItem[];
  payments: Payment[];
}

export default function OrderDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrder(await api.get<OrderDetail>(`/orders/me/${params.id}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load this order.");
    }
  }, [params.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    void load();
  }, [authLoading, user, router, load]);

  async function cancelOrder() {
    setCancelling(true);
    setError(null);
    try {
      await api.post(`/orders/me/${params.id}/cancel`, {});
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't cancel this order.");
    } finally {
      setCancelling(false);
    }
  }

  if (authLoading || !order) {
    return <main className="mx-auto max-w-2xl flex-1 px-6 py-12 text-sm text-[var(--muted)]">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-12">
      <Link href="/orders" className="mb-4 inline-block text-sm text-[var(--muted)] hover:underline">
        ← My orders
      </Link>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Order {order.orderNumber}</h1>
          <Link href={`/suppliers/${order.supplier.id}`} className="text-sm text-[var(--muted)] hover:underline">
            {order.supplier.tradingName}
          </Link>
        </div>
        <Badge tone={STATUS_TONE[order.status] ?? "neutral"}>{order.status.replaceAll("_", " ")}</Badge>
      </div>

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {order.status === "AWAITING_PAYMENT" && (
        <div className="mb-4">
          <Alert variant="info">
            Payment collection isn&apos;t wired up yet. This order is reserved until{" "}
            {order.paymentExpiresAt ? new Date(order.paymentExpiresAt).toLocaleTimeString() : "shortly"} — after that
            the stock is released automatically.
          </Alert>
        </div>
      )}

      <Card>
        <p className="mb-3 font-medium">Items</p>
        <ul className="flex flex-col gap-2 text-sm">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between">
              <span>
                {item.quantity} × {item.nameSnapshot}{" "}
                <span className="text-xs text-[var(--muted)]">(SKU {item.skuSnapshot})</span>
              </span>
              <span>${(Number(item.priceAtPurchase) * item.quantity).toLocaleString()}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-col gap-1 border-t border-[var(--border)] pt-3 text-sm">
          <div className="flex justify-between text-[var(--muted)]">
            <span>Subtotal</span>
            <span>${Number(order.subtotal).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-[var(--muted)]">
            <span>Delivery</span>
            <span>${Number(order.deliveryFee).toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>${Number(order.total).toLocaleString()}</span>
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        <p className="mb-2 font-medium">Fulfillment</p>
        <p className="text-sm text-[var(--muted)]">
          {order.deliveryProvider === "PICKUP" ? "Pickup" : "Delivery"} — {order.location.name},{" "}
          {order.location.address}
        </p>
        {order.deliveryProvider === "SUPPLIER_DELIVERY" && (
          <p className="mt-1 text-sm text-[var(--muted)]">
            {order.recipientName} · {order.recipientPhone} · {order.deliveryAddress}
          </p>
        )}
      </Card>

      {order.status === "AWAITING_PAYMENT" && (
        <div className="mt-6">
          <Button variant="secondary" disabled={cancelling} onClick={() => void cancelOrder()}>
            {cancelling ? "Cancelling…" : "Cancel order"}
          </Button>
        </div>
      )}
    </main>
  );
}
