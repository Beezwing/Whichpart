"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminUpdatePlanSchema } from "@autoparts/shared";
import { api, ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { Alert, Badge, Button, Card, Field, Input } from "../../../components/ui";

interface Plan {
  id: string;
  name: string;
  billingPeriod: string;
  priceUsd: string;
  trialDays: number;
  isActive: boolean;
}

export default function AdminSubscriptionPlansPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPlans(await api.get<Plan[]>("/admin/subscription-plans"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load subscription plans.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      router.push("/login");
      return;
    }
    void load();
  }, [authLoading, user, router, load]);

  if (authLoading || loading) {
    return <main className="mx-auto max-w-2xl flex-1 px-6 py-12 text-sm text-[var(--muted)]">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-12">
      <h1 className="mb-2 text-2xl font-semibold">Subscription plans</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">
        This is the pricing suppliers see — nothing about it is hardcoded in the app (Section 2).
      </p>

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {plans.map((plan) => (
          <PlanRow key={plan.id} plan={plan} onSaved={load} />
        ))}
      </div>
    </main>
  );
}

function PlanRow({ plan, onSaved }: { plan: Plan; onSaved: () => Promise<void> }) {
  const [priceUsd, setPriceUsd] = useState(plan.priceUsd);
  const [trialDays, setTrialDays] = useState(String(plan.trialDays));
  const [isActive, setIsActive] = useState(plan.isActive);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setError(null);
    const parsed = adminUpdatePlanSchema.safeParse({
      priceUsd: Number(priceUsd),
      trialDays: Number(trialDays),
      isActive,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your details.");
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/admin/subscription-plans/${plan.id}`, parsed.data);
      await onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this plan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-medium">
          {plan.name} <span className="text-xs text-[var(--muted)]">({plan.billingPeriod})</span>
        </p>
        <Badge tone={isActive ? "good" : "neutral"}>{isActive ? "Active" : "Inactive"}</Badge>
      </div>
      {error && (
        <div className="mb-3">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        <Field label="Price (USD)">
          <Input type="number" value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} />
        </Field>
        <Field label="Trial days">
          <Input type="number" value={trialDays} onChange={(e) => setTrialDays(e.target.value)} />
        </Field>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
        </label>
      </div>
      <div className="mt-3">
        <Button variant="secondary" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </Card>
  );
}
