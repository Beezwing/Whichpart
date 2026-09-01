"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { Alert, Badge, Card } from "../../components/ui";

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
  createdAt: string;
  supplier: { tradingName: string };
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

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setOrders(await api.get<OrderRow[]>("/orders/me"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your orders.");
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

  if (authLoading) return null;

  return (
    <main className="mx-auto max-w-3xl flex-1 px-6 py-12">
      <h1 className="mb-6 text-2xl font-semibold">My orders</h1>

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {orders.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No orders yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`}>
              <Card className="flex items-center justify-between hover:border-[var(--accent)]">
                <div>
                  <p className="font-medium">{o.supplier.tradingName}</p>
                  <p className="text-xs text-[var(--muted)]">
                    Order {o.orderNumber} · {new Date(o.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={STATUS_TONE[o.status] ?? "neutral"}>{o.status.replaceAll("_", " ")}</Badge>
                  <p className="font-semibold">${Number(o.total).toLocaleString()}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
