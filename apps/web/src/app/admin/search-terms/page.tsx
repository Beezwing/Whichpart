"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { Alert, Badge } from "../../../components/ui";

interface SearchTermRow {
  id: string;
  displayTerm: string;
  searchCount: number;
  noResultCount: number;
  noResultRate: number;
  lastSearchedAt: string;
}
interface SearchTermsResponse {
  items: SearchTermRow[];
  total: number;
  summary: {
    distinctTerms: number;
    totalSearches: number;
    totalNoResultSearches: number;
  };
}

const SORTS = [
  { label: "Most searched", value: "searchCount" },
  { label: "Most zero-result", value: "noResultCount" },
  { label: "Most recent", value: "recent" },
] as const;

export default function AdminSearchTermsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [sort, setSort] = useState<(typeof SORTS)[number]["value"]>("searchCount");
  const [data, setData] = useState<SearchTermsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (s: string) => {
    setLoading(true);
    try {
      setData(await api.get<SearchTermsResponse>(`/admin/search-terms?sort=${s}&pageSize=100`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load search terms.");
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
    void load(sort);
  }, [authLoading, user, router, sort, load]);

  if (authLoading) return null;

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Search terms</h1>
        <Link href="/admin/suppliers" className="text-sm text-[var(--accent)] hover:underline">
          ← Admin home
        </Link>
      </div>
      <p className="mb-6 text-sm text-[var(--muted)]">
        Anonymous and aggregate only — one running count per search term, no accounts or sessions attached. Zero-result
        terms are customers looking for parts you don&apos;t have listed yet.
      </p>

      {error && <Alert variant="error">{error}</Alert>}

      {data && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-[var(--border)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Distinct terms</p>
            <p className="mt-1 text-2xl font-semibold">{data.summary.distinctTerms.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Total searches</p>
            <p className="mt-1 text-2xl font-semibold">{data.summary.totalSearches.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Zero-result searches</p>
            <p className="mt-1 text-2xl font-semibold">{data.summary.totalNoResultSearches.toLocaleString()}</p>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {SORTS.map((s) => (
          <button
            key={s.value}
            onClick={() => setSort(s.value)}
            className={`rounded-full border px-3 py-1 text-sm ${
              sort === s.value
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {!loading && data?.items.length === 0 && !error && (
        <p className="text-sm text-[var(--muted)]">No searches recorded yet.</p>
      )}

      {data && data.items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--border)]/20 text-left text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Term</th>
                <th className="px-4 py-3">Searches</th>
                <th className="px-4 py-3">Zero-result</th>
                <th className="px-4 py-3">Last searched</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/search?q=${encodeURIComponent(row.displayTerm)}`} className="hover:underline">
                      {row.displayTerm}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{row.searchCount.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {row.noResultCount > 0 ? (
                      <Badge tone={row.noResultRate >= 50 ? "bad" : "warn"}>
                        {row.noResultCount} ({row.noResultRate}%)
                      </Badge>
                    ) : (
                      <span className="text-[var(--muted)]">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {new Date(row.lastSearchedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
