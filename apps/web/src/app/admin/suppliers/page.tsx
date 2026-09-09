"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { Alert, Badge } from "../../../components/ui";

interface SupplierRow {
  id: string;
  tradingName: string;
  legalBusinessName: string;
  verificationStatus: string;
  createdAt: string;
}

const STATUS_TONE: Record<string, "neutral" | "good" | "warn" | "bad"> = {
  DRAFT: "neutral",
  SUBMITTED: "warn",
  UNDER_REVIEW: "warn",
  ADDITIONAL_INFO_REQUIRED: "bad",
  APPROVED: "good",
  REJECTED: "bad",
  SUSPENDED: "bad",
  DEACTIVATED: "neutral",
};

const FILTERS = [
  { label: "All", value: "" },
  { label: "Submitted", value: "SUBMITTED" },
  { label: "Under review", value: "UNDER_REVIEW" },
  { label: "Needs info", value: "ADDITIONAL_INFO_REQUIRED" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Suspended", value: "SUSPENDED" },
];

export default function AdminSuppliersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (s: string) => {
    setLoading(true);
    try {
      const res = await api.get<{ items: SupplierRow[]; total: number }>(
        `/admin/suppliers${s ? `?status=${s}` : ""}`,
      );
      setRows(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load suppliers.");
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
    void load(status);
  }, [authLoading, user, router, status, load]);

  if (authLoading) return null;

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-12">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Supplier applications</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <Link href="/admin/categories" className="text-[var(--accent)] hover:underline">
            Categories →
          </Link>
          <Link href="/admin/vehicles" className="text-[var(--accent)] hover:underline">
            Vehicles →
          </Link>
          <Link href="/admin/subscription-plans" className="text-[var(--accent)] hover:underline">
            Subscription plans →
          </Link>
          <Link href="/admin/search-terms" className="text-[var(--accent)] hover:underline">
            Search terms →
          </Link>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatus(f.value)}
            className={`rounded-full border px-3 py-1 text-sm ${
              status === f.value
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {!loading && rows.length === 0 && !error && (
        <p className="text-sm text-[var(--muted)]">No suppliers match this filter.</p>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--border)]/20 text-left text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Applied</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3">
                  <Link href={`/admin/suppliers/${row.id}`} className="font-medium hover:underline">
                    {row.tradingName}
                  </Link>
                  <div className="text-xs text-[var(--muted)]">{row.legalBusinessName}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONE[row.verificationStatus] ?? "neutral"}>
                    {row.verificationStatus.replaceAll("_", " ")}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">{new Date(row.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">{total} total</p>
    </main>
  );
}
