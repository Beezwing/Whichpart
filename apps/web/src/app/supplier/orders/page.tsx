"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { Alert, Badge, Card } from "../../../components/ui";
import { SupplierTabs } from "../../../components/supplier-tabs";

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
  createdAt: string;
  customer: { name: string; phone: string | null };
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

export default function SupplierOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setOrders(await api.get<OrderRow[]>("/suppliers/me/orders"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load orders.");
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
      <h1 className="mb-2 text-2xl font-semibold">Supplier dashboard</h1>
      <SupplierTabs />

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
            <Link key={o.id} href={`/supplier/orders/${o.id}`}>
              <Card className="flex flex-col gap-2 hover:border-[var(--accent)] sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{o.customer.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    Order {o.orderNumber} · {new Date(o.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
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
