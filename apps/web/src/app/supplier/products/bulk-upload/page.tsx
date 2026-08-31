"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, apiUrl } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth-context";
import { Alert, Button, Card } from "../../../../components/ui";

interface ImportSummary {
  totalRows: number;
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
  warnings: { row: number; message: string }[];
}

export default function BulkUploadPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.push("/login");
  }, [authLoading, user, router]);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await api.postForm<ImportSummary>("/suppliers/me/products/bulk-import", form);
      setSummary(result);
      setFile(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading) return null;

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-12">
      <h1 className="mb-2 text-2xl font-semibold">Bulk upload</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">
        Add or update many products at once. Your SKU, price, and quantity are used exactly as entered — nothing
        automated changes them.
      </p>

      <Card className="mb-6">
        <h2 className="mb-2 text-lg font-medium">1. Get the template</h2>
        <p className="mb-3 text-sm text-[var(--muted)]">
          Includes the required columns and full instructions on the second sheet.
        </p>
        <a href={`${apiUrl}/suppliers/me/products/import-template`} target="_blank" rel="noreferrer">
          <Button variant="secondary">Download template (.xlsx)</Button>
        </a>
      </Card>

      <Card>
        <h2 className="mb-2 text-lg font-medium">2. Upload your file</h2>
        {error && (
          <div className="mb-3">
            <Alert variant="error">{error}</Alert>
          </div>
        )}
        <input
          type="file"
          accept=".xlsx"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mb-3 text-sm"
        />
        <div>
          <Button disabled={!file || busy} onClick={() => void upload()}>
            {busy ? "Importing…" : "Import"}
          </Button>
        </div>
      </Card>

      {summary && (
        <Card className="mt-6">
          <h2 className="mb-3 text-lg font-medium">Import summary</h2>
          <dl className="mb-4 grid grid-cols-4 gap-3 text-center text-sm">
            <div>
              <dt className="text-xs uppercase text-[var(--muted)]">Rows</dt>
              <dd className="text-xl font-semibold">{summary.totalRows}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-[var(--muted)]">Created</dt>
              <dd className="text-xl font-semibold text-green-700">{summary.created}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-[var(--muted)]">Updated</dt>
              <dd className="text-xl font-semibold text-[var(--accent)]">{summary.updated}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-[var(--muted)]">Errors</dt>
              <dd className="text-xl font-semibold text-red-700">{summary.errors.length}</dd>
            </div>
          </dl>

          {summary.warnings.length > 0 && (
            <div className="mb-3">
              <Alert variant="info">
                <p className="mb-1 font-medium">Warnings</p>
                <ul className="list-inside list-disc">
                  {summary.warnings.map((w, i) => (
                    <li key={i}>
                      Row {w.row}: {w.message}
                    </li>
                  ))}
                </ul>
              </Alert>
            </div>
          )}

          {summary.errors.length > 0 && (
            <Alert variant="error">
              <p className="mb-1 font-medium">Rows that couldn&apos;t be imported</p>
              <ul className="list-inside list-disc">
                {summary.errors.map((e, i) => (
                  <li key={i}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </Alert>
          )}
        </Card>
      )}
    </main>
  );
}
