"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { Alert, Badge, Button, Card, Field, Input } from "../../../components/ui";

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
  supplier: { tradingName: string };
}

const STATUS_TONE: Record<string, "neutral" | "good" | "warn"> = {
  PENDING: "warn",
  PAID: "good",
  WAIVED: "neutral",
};

function lastFullMonth(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function AdminInvoicesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [month, setMonth] = useState(lastFullMonth());
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const load = useCallback(async (status: string) => {
    try {
      const query = status ? `?status=${status}` : "";
      setInvoices(await api.get<Invoice[]>(`/admin/invoices${query}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load invoices.");
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
    void load(statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, router]);

  async function generate() {
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.post<{ created: number; skipped: number }>("/admin/invoices/generate", { month });
      setResult(`Generated ${res.created} invoice${res.created === 1 ? "" : "s"} (${res.skipped} skipped — already existed or nothing owed).`);
      await load(statusFilter);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't generate invoices.");
    } finally {
      setGenerating(false);
    }
  }

  async function markPaid(id: string) {
    setError(null);
    try {
      await api.post(`/admin/invoices/${id}/mark-paid`);
      await load(statusFilter);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't mark that invoice paid.");
    }
  }

  if (authLoading || loading) {
    return <main className="mx-auto max-w-4xl flex-1 px-6 py-12 text-sm text-[var(--muted)]">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-12">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Supplier invoices</h1>
        <Link href="/admin/suppliers" className="text-sm text-[var(--accent)] hover:underline">
          ← Supplier applications
        </Link>
      </div>

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
      {result && (
        <div className="mb-4">
          <Alert variant="success">{result}</Alert>
        </div>
      )}

      <Card className="mb-6">
        <p className="mb-3 font-medium">Generate this month&apos;s invoices</p>
        <p className="mb-4 text-sm text-[var(--muted)]">
          One invoice per supplier for the chosen month: the service fee (if on a monthly plan) plus commission on
          every order marked paid during that month. Safe to run more than once — a supplier who already has an
          invoice for that month is skipped.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Month">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </Field>
          <Button disabled={generating} onClick={() => void generate()}>
            {generating ? "Generating…" : "Generate invoices"}
          </Button>
        </div>
      </Card>

      <div className="mb-4 flex gap-2 text-sm">
        {["", "PENDING", "PAID", "WAIVED"].map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatusFilter(s);
              void load(s);
            }}
            className={`rounded-lg border px-3 py-1.5 ${
              statusFilter === s
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "border-[var(--border)]"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {invoices.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No invoices for this filter.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {invoices.map((inv) => (
            <Card key={inv.id}>
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{inv.supplier.tradingName}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {new Date(inv.periodStart).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[inv.status] ?? "neutral"}>{inv.status}</Badge>
              </div>
              <dl className="mb-3 grid grid-cols-3 gap-2 text-sm text-[var(--muted)]">
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
              {inv.status === "PENDING" && (
                <Button variant="secondary" onClick={() => void markPaid(inv.id)}>
                  Mark paid
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
