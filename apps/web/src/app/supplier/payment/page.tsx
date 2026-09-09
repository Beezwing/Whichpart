"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { paymentAccountSchema } from "@autoparts/shared";
import { api, ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { Alert, Badge, Button, Card, Field, Input } from "../../../components/ui";
import { SupplierTabs } from "../../../components/supplier-tabs";

type Provider = "LUNIPAY" | "FYGARO" | "DIMEPAY";

const PROVIDER_LABELS: Record<Provider, string> = {
  LUNIPAY: "LuniPay",
  FYGARO: "Fygaro",
  DIMEPAY: "DimePay",
};

interface PaymentAccount {
  provider: Provider;
  status: string;
  publicIdentifier: string;
  maskedApiKey: string | null;
  connectedAt: string | null;
}

export default function PaymentPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [account, setAccount] = useState<PaymentAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ provider: "LUNIPAY" as Provider, publicIdentifier: "", apiKey: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<PaymentAccount | null>("/suppliers/me/payment-account");
      setAccount(res);
      if (res) setForm({ provider: res.provider, publicIdentifier: res.publicIdentifier, apiKey: "" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your payment settings.");
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const parsed = paymentAccountSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[issue.path[0] as string] = issue.message;
      setFieldErrors(errs);
      return;
    }
    setSaving(true);
    try {
      await api.put("/suppliers/me/payment-account", parsed.data);
      await load();
      setForm((f) => ({ ...f, apiKey: "" }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your payment connection.");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) {
    return <main className="mx-auto max-w-2xl flex-1 px-6 py-12 text-sm text-[var(--muted)]">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-12">
      <h1 className="mb-2 text-2xl font-semibold">Payment settings</h1>
      <SupplierTabs />

      <Alert variant="info">
        Customer payments go straight to <strong>your own</strong> LuniPay, Fygaro, or DimePay account — the
        marketplace never holds or touches your sale proceeds. Enter the same account you use to accept payments
        today.
      </Alert>

      {error && (
        <div className="mt-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {account && (
        <Card className="mt-6">
          <div className="flex items-center justify-between">
            <p className="font-medium">{PROVIDER_LABELS[account.provider]}</p>
            <Badge tone={account.status === "CONNECTED" ? "good" : "neutral"}>{account.status}</Badge>
          </div>
          <p className="mt-2 break-words text-sm text-[var(--muted)]">Identifier: {account.publicIdentifier}</p>
          {account.maskedApiKey && (
            <p className="break-words text-sm text-[var(--muted)]">API key on file: {account.maskedApiKey}</p>
          )}
        </Card>
      )}

      <Card className="mt-6">
        <h2 className="mb-4 text-lg font-medium">{account ? "Update connection" : "Connect a provider"}</h2>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="Provider">
            <select
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value as Provider })}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              {(Object.keys(PROVIDER_LABELS) as Provider[]).map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Public payment identifier (e.g. your payment link ID)" error={fieldErrors.publicIdentifier}>
            <Input
              value={form.publicIdentifier}
              onChange={(e) => setForm({ ...form, publicIdentifier: e.target.value })}
            />
          </Field>
          <Field label="API key" error={fieldErrors.apiKey}>
            <Input
              type="password"
              placeholder={account ? "Enter a new key to replace the one on file" : ""}
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            />
          </Field>
          <div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : account ? "Update connection" : "Connect"}
            </Button>
          </div>
        </form>
      </Card>
    </main>
  );
}
