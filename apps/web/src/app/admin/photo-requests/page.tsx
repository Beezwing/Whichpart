"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { Alert, Badge, Card } from "../../../components/ui";

interface PhotoRequestRow {
  id: string;
  status: string;
  requestedAt: string;
  product: { id: string; name: string; sku: string; supplier: { tradingName: string } };
  customer: { name: string };
}

interface ProductGroup {
  product: PhotoRequestRow["product"];
  requests: PhotoRequestRow[];
}

function groupByProduct(rows: PhotoRequestRow[]): ProductGroup[] {
  const map = new Map<string, ProductGroup>();
  for (const row of rows) {
    const existing = map.get(row.product.id);
    if (existing) existing.requests.push(row);
    else map.set(row.product.id, { product: row.product, requests: [row] });
  }
  return Array.from(map.values());
}

export default function AdminPhotoRequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<PhotoRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [uploadingProductId, setUploadingProductId] = useState<string | null>(null);

  const load = useCallback(async (status: string) => {
    try {
      const query = status ? `?status=${status}` : "";
      setRows(await api.get<PhotoRequestRow[]>(`/admin/photo-requests${query}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load photo requests.");
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

  async function uploadPhoto(productId: string, file: File) {
    setUploadingProductId(productId);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      await api.postForm(`/admin/products/${productId}/images`, form);
      await load(statusFilter);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't upload that photo.");
    } finally {
      setUploadingProductId(null);
    }
  }

  if (authLoading || loading) {
    return <main className="mx-auto max-w-4xl flex-1 px-6 py-12 text-sm text-[var(--muted)]">Loading…</main>;
  }

  const groups = groupByProduct(rows);

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-12">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Photo requests</h1>
        <Link href="/admin/suppliers" className="text-sm text-[var(--accent)] hover:underline">
          ← Supplier applications
        </Link>
      </div>
      <p className="mb-6 text-sm text-[var(--muted)]">
        Customers asked for photos on these listings. Visit the supplier, photograph the part, and upload it here —
        every customer who asked is notified automatically once you do.
      </p>

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <div className="mb-4 flex gap-2 text-sm">
        {["PENDING", "FULFILLED", ""].map((s) => (
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

      {groups.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No requests for this filter.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g) => (
            <Card key={g.product.id}>
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link href={`/product/${g.product.id}`} className="font-medium hover:underline" target="_blank">
                    {g.product.name}
                  </Link>
                  <p className="text-xs text-[var(--muted)]">
                    SKU {g.product.sku} · {g.product.supplier.tradingName}
                  </p>
                </div>
                <Badge tone={g.requests[0].status === "PENDING" ? "warn" : "good"}>
                  {g.requests.length} request{g.requests.length === 1 ? "" : "s"}
                </Badge>
              </div>
              <ul className="mb-3 flex flex-col gap-1 text-xs text-[var(--muted)]">
                {g.requests.map((r) => (
                  <li key={r.id}>
                    {r.customer.name} — {new Date(r.requestedAt).toLocaleDateString()} ({r.status})
                  </li>
                ))}
              </ul>
              {g.requests.some((r) => r.status === "PENDING") && (
                <label className="inline-block cursor-pointer rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--border)]/20">
                  {uploadingProductId === g.product.id ? "Uploading…" : "Upload photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploadingProductId === g.product.id}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadPhoto(g.product.id, file);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
