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
  priceUsd: string;
  trialDays: number;
}
interface SubscriptionRow {
  id: string;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  plan: Plan;
}

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [sub, planList] = await Promise.all([
        api.get<SubscriptionRow | null>("/suppliers/me/subscription"),
        api.get<Plan[]>("/subscription-plans"),
      ]);
      setSubscription(sub);
      setPlans(planList);
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
              <dd>${subscription.plan.priceUsd} USD / {subscription.plan.billingPeriod.toLowerCase()}</dd>
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
        Billing collection isn&apos;t connected yet — switching plans updates your account, but there&apos;s
        nothing to pay until that&apos;s wired up.
      </p>
      <div className="grid grid-cols-2 gap-4">
        {plans.map((plan) => {
          const isCurrent = subscription?.plan.id === plan.id;
          return (
            <Card key={plan.id}>
              <p className="font-medium">{plan.name}</p>
              <p className="text-2xl font-semibold">${plan.priceUsd}</p>
              <p className="mb-3 text-xs text-[var(--muted)]">USD / {plan.billingPeriod.toLowerCase()}</p>
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
    </main>
  );
}
