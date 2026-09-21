"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { Alert, Badge, Button, Card } from "../../../components/ui";
import { SupplierTabs } from "../../../components/supplier-tabs";

interface Plan {
  id: string;
  name: string;
  billingPeriod: string;
  price: string;
  currency: string;
  commissionRate: string;
  trialDays: number;
}
interface SubscriptionRow {
  id: string;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  plan: Plan;
}
interface Invoice {
  id: string;
  periodStart: string;
  periodEnd: string;
  serviceFeeAmount: string;
  commissionAmount: string;
  totalDue: string;
  currency: string;
  status: string;
  paidAt: string | null;
}

const INVOICE_STATUS_TONE: Record<string, "neutral" | "good" | "warn"> = {
  PENDING: "warn",
  PAID: "good",
  WAIVED: "neutral",
};

const STATUS_TONE: Record<string, "neutral" | "good" | "warn" | "bad"> = {
  TRIAL: "warn",
  ACTIVE: "good",
  PAST_DUE: "bad",
  CANCELLED: "neutral",
  EXPIRED: "bad",
  SUSPENDED: "bad",
};

export default function SubscriptionPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [sub, planList, invoiceList] = await Promise.all([
        api.get<SubscriptionRow | null>("/suppliers/me/subscription"),
        api.get<Plan[]>("/subscription-plans"),
        api.get<Invoice[]>("/suppliers/me/invoices"),
      ]);
      setSubscription(sub);
      setPlans(planList);
      setInvoices(invoiceList);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your subscription.");
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
    void load();
  }, [authLoading, user, router, load]);

  async function switchPlan(planId: string) {
    setBusy(true);
    setError(null);
    try {
      await api.post("/suppliers/me/subscription/plan", { planId });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't switch plans.");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || loading) {
    return <main className="mx-auto max-w-2xl flex-1 px-6 py-12 text-sm text-[var(--muted)]">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-12">
      <h1 className="mb-2 text-2xl font-semibold">Subscription</h1>
      <SupplierTabs />

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {subscription ? (
        <Card className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-medium">{subscription.plan.name} plan</p>
            <Badge tone={STATUS_TONE[subscription.status] ?? "neutral"}>{subscription.status}</Badge>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-sm text-[var(--muted)]">
            <div>
              <dt className="text-xs uppercase">Price</dt>
              <dd>
                ${subscription.plan.price} {subscription.plan.currency} /{" "}
                {subscription.plan.billingPeriod.toLowerCase()}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase">Commission</dt>
              <dd>{(Number(subscription.plan.commissionRate) * 100).toFixed(1)}% per sale</dd>
            </div>
            {subscription.status === "TRIAL" && subscription.trialEndsAt && (
              <div>
                <dt className="text-xs uppercase">Trial ends</dt>
                <dd>{new Date(subscription.trialEndsAt).toLocaleDateString()}</dd>
              </div>
            )}
            {subscription.currentPeriodEnd && (
              <div>
                <dt className="text-xs uppercase">Renews</dt>
                <dd>{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</dd>
              </div>
            )}
          </dl>
        </Card>
      ) : (
        <Alert variant="info">Your subscription will start automatically once your application is approved.</Alert>
      )}

      <h2 className="mb-3 text-lg font-medium">Available plans</h2>
      <p className="mb-4 text-xs text-[var(--muted)]">
        Pay monthly, or the year upfront on the Annual plan — either way, a {(Number(plans[0]?.commissionRate ?? 0) * 100).toFixed(1)}%
        commission applies per sale. Billing is collected by invoice at the end of each month (see your statements
        below) — nothing is charged to a card automatically.
      </p>
      <div className="grid grid-cols-2 gap-4">
        {plans.map((plan) => {
          const isCurrent = subscription?.plan.id === plan.id;
          return (
            <Card key={plan.id}>
              <p className="font-medium">{plan.name}</p>
              <p className="text-2xl font-semibold">
                ${plan.price} {plan.currency}
              </p>
              <p className="mb-3 text-xs text-[var(--muted)]">/ {plan.billingPeriod.toLowerCase()}</p>
              <Button
                variant={isCurrent ? "secondary" : "primary"}
                disabled={isCurrent || busy || !subscription}
                onClick={() => void switchPlan(plan.id)}
              >
                {isCurrent ? "Current plan" : "Switch to this plan"}
              </Button>
            </Card>
          );
        })}
      </div>

      <h2 className="mb-3 mt-8 text-lg font-medium">Statements</h2>
      {invoices.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No statements yet — these appear after your first full month.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {invoices.map((inv) => (
            <Card key={inv.id}>
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium">
                  {new Date(inv.periodStart).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </p>
                <Badge tone={INVOICE_STATUS_TONE[inv.status] ?? "neutral"}>{inv.status}</Badge>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-sm text-[var(--muted)]">
                <div>
                  <dt className="text-xs uppercase">Service fee</dt>
                  <dd>
                    ${inv.serviceFeeAmount} {inv.currency}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase">Commission</dt>
                  <dd>
                    ${inv.commissionAmount} {inv.currency}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase">Total due</dt>
                  <dd className="font-medium text-[var(--foreground)]">
                    ${inv.totalDue} {inv.currency}
                  </dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
