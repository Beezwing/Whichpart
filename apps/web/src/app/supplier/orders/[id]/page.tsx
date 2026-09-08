"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SUPPLIER_SETTABLE_ORDER_STATUSES } from "@autoparts/shared";
import { api, ApiError } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth-context";
import { Alert, Badge, Button, Card } from "../../../../components/ui";

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
  customer: { name: string; phone: string | null };
  location: { name: string; address: string };
  items: OrderItem[];
  payments: Payment[];
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

export default function SupplierOrderDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState<string>(SUPPLIER_SETTABLE_ORDER_STATUSES[0]);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrder(await api.get<OrderDetail>(`/suppliers/me/orders/${params.id}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load this order.");
    }
  }, [params.id]);

  async function updateStatus() {
    setError(null);
    setUpdating(true);
    try {
      await api.patch(`/suppliers/me/orders/${params.id}/status`, { status: nextStatus });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update this order's status.");
    } finally {
      setUpdating(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    void load();
  }, [authLoading, user, router, load]);

  if (authLoading || !order) {
    return <main className="mx-auto max-w-2xl flex-1 px-6 py-12 text-sm text-[var(--muted)]">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-12">
      <Link href="/supplier/orders" className="mb-4 inline-block text-sm text-[var(--muted)] hover:underline">
        ← Orders
      </Link>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Order {order.orderNumber}</h1>
          <p className="text-sm text-[var(--muted)]">
            {order.customer.name}
            {order.customer.phone ? ` · ${order.customer.phone}` : ""}
          </p>
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
            Awaiting the customer&apos;s payment. Reserved until{" "}
            {order.paymentExpiresAt ? new Date(order.paymentExpiresAt).toLocaleTimeString() : "shortly"} — automated
            payment collection isn&apos;t connected yet. Once you&apos;ve confirmed payment directly (LuniPay, Fygaro,
            or DimePay), mark it Paid below.
          </Alert>
        </div>
      )}

      {!["CANCELLED", "COMPLETED", "REFUNDED"].includes(order.status) && (
        <Card className="mb-4">
          <p className="mb-2 font-medium">Update status</p>
          <div className="flex gap-2">
            <select
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value)}
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              {SUPPLIER_SETTABLE_ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <Button disabled={updating} onClick={() => void updateStatus()}>
              {updating ? "Updating…" : "Update"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">
            The customer gets an email as soon as you update this.
          </p>
        </Card>
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
    </main>
  );
}
