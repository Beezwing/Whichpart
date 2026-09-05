"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth-context";
import { Alert, Badge, Button, Card } from "../../../../components/ui";
import { SupplierTabs } from "../../../../components/supplier-tabs";

interface ProductRow {
  id: string;
  sku: string;
  name: string;
  images: { id: string }[];
}

interface UploadResult {
  filename: string;
  productName: string;
  status: "ok" | "failed";
  message?: string;
}

// This exists because there's no reliable way to auto-match a pile of
// unlabeled real photos to specific SKUs (see the bulk-images filename
// matcher for the case where files ARE already named after a SKU) --
// many products look visually identical without a legible part-number
// label. A human still has to make each call; this just makes doing
// that 400 times fast instead of "open each product's page, one at a
// time." Everything here is in-memory only -- refreshing loses progress,
// so nothing uploads until you confirm at the end.
export default function MatchPhotosPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [index, setIndex] = useState(0);
  const [matches, setMatches] = useState<Map<number, ProductRow>>(new Map());
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadResult[] | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    void api
      .get<ProductRow[]>("/suppliers/me/products")
      .then(setProducts)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Couldn't load your products."));
  }, [authLoading, user, router]);

  // Object URLs must be revoked or they leak memory across a batch of
  // hundreds of photos.
  useEffect(() => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const file = files[index];
    if (!file) {
      setPreviewUrl(null);
      objectUrlRef.current = null;
      return;
    }
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [files, index]);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, [index, reviewing]);

  function pickFiles(list: FileList | null) {
    if (!list) return;
    setFiles(Array.from(list));
    setIndex(0);
    setMatches(new Map());
    setSkipped(new Set());
    setQuery("");
    setReviewing(false);
    setUploadResults(null);
  }

  function resetToFilePicker() {
    setFiles([]);
    setIndex(0);
    setMatches(new Map());
    setSkipped(new Set());
    setQuery("");
    setReviewing(false);
    setUploadResults(null);
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 8);
  }, [products, query]);

  function advance() {
    setQuery("");
    if (index + 1 >= files.length) setReviewing(true);
    else setIndex(index + 1);
  }

  function assign(product: ProductRow) {
    setMatches((prev) => new Map(prev).set(index, product));
    setSkipped((prev) => {
      if (!prev.has(index)) return prev;
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
    advance();
  }

  function skip() {
    setSkipped((prev) => new Set(prev).add(index));
    advance();
  }

  function goBack() {
    if (index === 0) return;
    setReviewing(false);
    setQuery("");
    setIndex(index - 1);
  }

  async function uploadMatched() {
    const entries = [...matches.entries()];
    setUploading(true);
    setUploadProgress(0);
    const out: UploadResult[] = [];
    for (const [fileIndex, product] of entries) {
      const file = files[fileIndex];
      try {
        const form = new FormData();
        form.append("file", file);
        await api.postForm(`/suppliers/me/products/${product.id}/images`, form);
        out.push({ filename: file.name, productName: product.name, status: "ok" });
      } catch (err) {
        out.push({
          filename: file.name,
          productName: product.name,
          status: "failed",
          message: err instanceof ApiError ? err.message : "Upload failed.",
        });
      }
      setUploadProgress((p) => p + 1);
    }
    setUploadResults(out);
    setUploading(false);
  }

  if (authLoading) return null;

  return (
    <main className="mx-auto max-w-3xl flex-1 px-6 py-12">
      <h1 className="mb-2 text-2xl font-semibold">Supplier dashboard</h1>
      <SupplierTabs />

      <h2 className="mb-2 text-xl font-semibold">Match photos to products</h2>
      <p className="mb-6 text-sm text-[var(--muted)]">
        For real photos of your inventory that aren&apos;t already named after a SKU. If your files ARE already
        named after each SKU (e.g. <code>MIT-SHO-065.jpg</code>), use{" "}
        <Link href="/supplier/products/bulk-upload" className="text-[var(--accent)] hover:underline">
          bulk photos
        </Link>{" "}
        instead — it matches automatically with no manual work. This page is for everything else: you look at each
        photo and pick which product it is. Nothing uploads until you confirm at the end, and refreshing this page
        loses your progress.
      </p>

      {loadError && (
        <div className="mb-4">
          <Alert variant="error">{loadError}</Alert>
        </div>
      )}

      {files.length === 0 && (
        <Card>
          <h3 className="mb-2 text-lg font-medium">Select photos</h3>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => pickFiles(e.target.files)}
            className="text-sm"
          />
        </Card>
      )}

      {files.length > 0 && !reviewing && !uploadResults && (
        <Card>
          <div className="mb-3 flex items-center justify-between text-sm text-[var(--muted)]">
            <span>
              Photo {index + 1} of {files.length}
            </span>
            <span>
              {matches.size} matched · {skipped.size} skipped
            </span>
          </div>

          <div className="mb-4 flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a served asset
              <img src={previewUrl} alt={files[index]?.name} className="h-full w-full object-contain" />
            )}
          </div>
          <p className="mb-3 truncate text-xs text-[var(--muted)]">{files[index]?.name}</p>

          {matches.has(index) && (
            <p className="mb-2 text-sm text-green-700">
              ✓ Matched to {matches.get(index)!.name} (SKU {matches.get(index)!.sku})
            </p>
          )}

          <input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) assign(results[0]);
            }}
            placeholder="Type product name or SKU…"
            className="mb-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          />

          {results.length > 0 && (
            <ul className="mb-3 flex flex-col gap-1">
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => assign(p)}
                    className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-left text-sm hover:border-[var(--accent)]"
                  >
                    <span>
                      {p.name} <span className="text-xs text-[var(--muted)]">SKU {p.sku}</span>
                    </span>
                    {p.images.length > 0 && <Badge tone="neutral">has photo</Badge>}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={goBack} disabled={index === 0}>
              Back
            </Button>
            <Button variant="secondary" onClick={skip}>
              Skip this photo
            </Button>
            <button
              onClick={() => setReviewing(true)}
              className="ml-auto text-xs text-[var(--muted)] hover:underline"
            >
              Stop here and review
            </button>
          </div>
        </Card>
      )}

      {reviewing && !uploadResults && (
        <Card>
          <h3 className="mb-3 text-lg font-medium">Review before uploading</h3>
          <dl className="mb-4 grid grid-cols-3 gap-3 text-center text-sm">
            <div>
              <dt className="text-xs uppercase text-[var(--muted)]">Matched</dt>
              <dd className="text-xl font-semibold text-green-700">{matches.size}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-[var(--muted)]">Skipped</dt>
              <dd className="text-xl font-semibold text-[var(--muted)]">{skipped.size}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-[var(--muted)]">Total photos</dt>
              <dd className="text-xl font-semibold">{files.length}</dd>
            </div>
          </dl>

          {matches.size > 0 && (
            <ul className="mb-4 flex max-h-64 flex-col gap-1 overflow-y-auto text-sm text-[var(--muted)]">
              {[...matches.entries()].map(([fileIndex, product]) => (
                <li key={fileIndex}>
                  {files[fileIndex].name} → {product.name} <span className="text-xs">(SKU {product.sku})</span>
                </li>
              ))}
            </ul>
          )}

          {uploading && (
            <p className="mb-3 text-sm text-[var(--muted)]">
              Uploading… {uploadProgress} / {matches.size}
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setReviewing(false)} disabled={uploading}>
              Keep matching
            </Button>
            <Button disabled={matches.size === 0 || uploading} onClick={() => void uploadMatched()}>
              {uploading ? "Uploading…" : `Upload ${matches.size} photo(s)`}
            </Button>
          </div>
        </Card>
      )}

      {uploadResults && (
        <Card>
          <h3 className="mb-3 text-lg font-medium">Upload summary</h3>
          <dl className="mb-4 grid grid-cols-2 gap-3 text-center text-sm">
            <div>
              <dt className="text-xs uppercase text-[var(--muted)]">Uploaded</dt>
              <dd className="text-xl font-semibold text-green-700">
                {uploadResults.filter((r) => r.status === "ok").length}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-[var(--muted)]">Failed</dt>
              <dd className="text-xl font-semibold text-red-700">
                {uploadResults.filter((r) => r.status === "failed").length}
              </dd>
            </div>
          </dl>
          {uploadResults.some((r) => r.status === "failed") && (
            <div className="mb-3">
              <Alert variant="error">
                <p className="mb-1 font-medium">These didn&apos;t upload — try them again individually</p>
                <ul className="list-inside list-disc">
                  {uploadResults
                    .filter((r) => r.status === "failed")
                    .map((r, i) => (
                      <li key={i}>
                        {r.filename} → {r.productName}: {r.message}
                      </li>
                    ))}
                </ul>
              </Alert>
            </div>
          )}
          <Button onClick={resetToFilePicker}>Match more photos</Button>
        </Card>
      )}
    </main>
  );
}
