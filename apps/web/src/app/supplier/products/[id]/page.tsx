"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { updateInventorySchema, updateProductSchema } from "@autoparts/shared";
import { api, ApiError, apiUrl } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth-context";
import { flattenCategories, type CategoryNode } from "../../../../lib/categories";
import { Alert, Badge, Button, Card, Field, Input, Textarea } from "../../../../components/ui";

const CONDITIONS = ["NEW", "USED", "REFURBISHED", "RECONDITIONED", "OEM", "AFTERMARKET"];

interface ProductImage {
  id: string;
  url: string;
  isPrimary: boolean;
}
interface InventoryRow {
  id: string;
  locationId: string;
  quantity: number;
  lowStockThreshold: number | null;
  criticalStockThreshold: number | null;
  location: { id: string; name: string };
}
interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
  condition: string;
  price: string;
  isActive: boolean;
  oemPartNumber: string | null;
  manufacturerPartNumber: string | null;
  requiresFreightQuote: boolean;
  aiSuggestedCategoryId: string | null;
  aiSuggestedKeywords: string[];
  aiCleanedDescription: string | null;
  images: ProductImage[];
  inventory: InventoryRow[];
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<{ id: string; label: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, tree] = await Promise.all([
        api.get<Product>(`/suppliers/me/products/${id}`),
        api.get<CategoryNode[]>("/categories"),
      ]);
      setProduct(p);
      setCategories(flattenCategories(tree));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load this product.");
    }
  }, [id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    void load();
  }, [authLoading, user, router, load]);

  if (authLoading || (!product && !error)) {
    return <main className="mx-auto max-w-2xl flex-1 px-6 py-12 text-sm text-[var(--muted)]">Loading…</main>;
  }
  if (!product) {
    return (
      <main className="mx-auto max-w-2xl flex-1 px-6 py-12">
        <Alert variant="error">{error}</Alert>
      </main>
    );
  }

  const suggestedCategoryName = categories.find((c) => c.id === product.aiSuggestedCategoryId)?.label;
  const hasSuggestion = Boolean(
    product.aiSuggestedCategoryId || product.aiSuggestedKeywords.length > 0 || product.aiCleanedDescription,
  );

  async function runAction(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{product.name}</h1>
          <p className="text-sm text-[var(--muted)]">SKU {product.sku}</p>
        </div>
        <div className="flex items-center gap-2">
          {!product.isActive && <Badge tone="neutral">Inactive</Badge>}
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void runAction(() => api.post(`/suppliers/me/products/${id}/${product.isActive ? "deactivate" : "activate"}`))}
          >
            {product.isActive ? "Deactivate" : "Reactivate"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {hasSuggestion && (
        <Card className="mb-6 border-[var(--accent)]">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--accent)]">AI suggestion</p>
          {suggestedCategoryName && <p className="text-sm">Suggested category: {suggestedCategoryName}</p>}
          {product.aiSuggestedKeywords.length > 0 && (
            <p className="text-sm">Keywords: {product.aiSuggestedKeywords.join(", ")}</p>
          )}
          {product.aiCleanedDescription && (
            <p className="text-sm text-[var(--muted)]">Cleaned description: “{product.aiCleanedDescription}”</p>
          )}
          <p className="mt-2 text-xs text-[var(--muted)]">
            This never touches your price, quantity, or SKU — only category and wording, and only if you approve.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              disabled={busy}
              onClick={() => void runAction(() => api.post(`/suppliers/me/products/${id}/ai-suggestion/approve`))}
            >
              Approve
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void runAction(() => api.post(`/suppliers/me/products/${id}/ai-suggestion/dismiss`))}
            >
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      <ImageGallery productId={id} images={product.images} onChanged={load} />
      <BusinessInfoForm product={product} categories={categories} onSaved={load} />
      <InventoryEditor productId={id} inventory={product.inventory} onChanged={load} />

      <Card className="mt-6 border-red-200">
        <p className="mb-2 text-sm font-medium text-red-700">Delete this product</p>
        <p className="mb-3 text-xs text-[var(--muted)]">Permanent — removes all photos and inventory records.</p>
        <Button
          variant="danger"
          disabled={busy}
          onClick={() => {
            if (!confirm("Delete this product permanently?")) return;
            void runAction(async () => {
              await api.delete(`/suppliers/me/products/${id}`);
              router.push("/supplier/products");
            });
          }}
        >
          Delete product
        </Button>
      </Card>
    </main>
  );
}

function BusinessInfoForm({
  product,
  categories,
  onSaved,
}: {
  product: Product;
  categories: { id: string; label: string }[];
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: product.name,
    description: product.description ?? "",
    categoryId: product.categoryId ?? "",
    brand: product.brand?.name ?? "",
    condition: product.condition,
    price: product.price,
    oemPartNumber: product.oemPartNumber ?? "",
    manufacturerPartNumber: product.manufacturerPartNumber ?? "",
    requiresFreightQuote: product.requiresFreightQuote,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setErrors({});
    const parsed = updateProductSchema.safeParse({
      name: form.name,
      description: form.description || undefined,
      categoryId: form.categoryId || undefined,
      brand: form.brand || undefined,
      condition: form.condition,
      price: Number(form.price),
      oemPartNumber: form.oemPartNumber || undefined,
      manufacturerPartNumber: form.manufacturerPartNumber || undefined,
      requiresFreightQuote: form.requiresFreightQuote,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as string] = issue.message;
      setErrors(fieldErrors);
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/suppliers/me/products/${product.id}`, parsed.data);
      setStatus({ type: "success", message: "Saved." });
      await onSaved();
    } catch (err) {
      setStatus({ type: "error", message: err instanceof ApiError ? err.message : "Couldn't save changes." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-6">
      <h2 className="mb-4 text-lg font-medium">Details</h2>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {status && (
          <div className="sm:col-span-2">
            <Alert variant={status.type}>{status.message}</Alert>
          </div>
        )}
        <div className="sm:col-span-2">
          <Field label="Product name" error={errors.name}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Description" error={errors.description}>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Category">
          <select
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          >
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Brand">
          <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
        </Field>
        <Field label="Condition">
          <select
            value={form.condition}
            onChange={(e) => setForm({ ...form, condition: e.target.value })}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          >
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Price (JMD)" error={errors.price}>
          <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        </Field>
        <Field label="OEM part number">
          <Input
            value={form.oemPartNumber}
            onChange={(e) => setForm({ ...form, oemPartNumber: e.target.value })}
          />
        </Field>
        <Field label="Manufacturer part number">
          <Input
            value={form.manufacturerPartNumber}
            onChange={(e) => setForm({ ...form, manufacturerPartNumber: e.target.value })}
          />
        </Field>
        <div className="sm:col-span-2">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.requiresFreightQuote}
              onChange={(e) => setForm({ ...form, requiresFreightQuote: e.target.checked })}
            />
            <span>
              Requires a manual freight quote
              <span className="block text-xs text-[var(--muted)]">
                Oversized/heavy — complete engines, engine blocks. Customers can only pick this up or contact you to
                arrange delivery; it won&apos;t use your flat delivery zone fees.
              </span>
            </span>
          </label>
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ImageGallery({
  productId,
  images,
  onChanged,
}: {
  productId: string;
  images: ProductImage[];
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      await api.postForm(`/suppliers/me/products/${productId}/images`, form);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function setPrimary(imageId: string) {
    setBusy(true);
    try {
      await api.patch(`/suppliers/me/products/${productId}/images/${imageId}/primary`);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't set primary image.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(imageId: string) {
    setBusy(true);
    try {
      await api.delete(`/suppliers/me/products/${productId}/images/${imageId}`);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-6">
      <h2 className="mb-4 text-lg font-medium">Photos</h2>
      {error && (
        <div className="mb-3">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-3">
        {images.map((img) => (
          <div key={img.id} className="flex flex-col items-center gap-1">
            <img
              src={`${apiUrl}/products/images/${img.id}/file`}
              alt=""
              className="h-24 w-24 rounded-lg border border-[var(--border)] object-cover"
            />
            <div className="flex gap-2 text-xs">
              {img.isPrimary ? (
                <span className="text-[var(--accent)]">Primary</span>
              ) : (
                <button disabled={busy} onClick={() => void setPrimary(img.id)} className="text-[var(--muted)]">
                  Make primary
                </button>
              )}
              <button disabled={busy} onClick={() => void remove(img.id)} className="text-red-600">
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
        className="text-sm"
      />
    </Card>
  );
}

function InventoryEditor({
  productId,
  inventory,
  onChanged,
}: {
  productId: string;
  inventory: InventoryRow[];
  onChanged: () => Promise<void>;
}) {
  return (
    <Card className="mb-6">
      <h2 className="mb-4 text-lg font-medium">Inventory by location</h2>
      <div className="flex flex-col gap-4">
        {inventory.map((row) => (
          <InventoryRowEditor key={row.id} productId={productId} row={row} onChanged={onChanged} />
        ))}
      </div>
    </Card>
  );
}

function InventoryRowEditor({
  productId,
  row,
  onChanged,
}: {
  productId: string;
  row: InventoryRow;
  onChanged: () => Promise<void>;
}) {
  const [quantity, setQuantity] = useState(String(row.quantity));
  const [lowStock, setLowStock] = useState(row.lowStockThreshold?.toString() ?? "");
  const [criticalStock, setCriticalStock] = useState(row.criticalStockThreshold?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setError(null);
    const parsed = updateInventorySchema.safeParse({
      quantity: Number(quantity),
      lowStockThreshold: lowStock ? Number(lowStock) : null,
      criticalStockThreshold: criticalStock ? Number(criticalStock) : null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your details.");
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/suppliers/me/products/${productId}/inventory/${row.locationId}`, parsed.data);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update inventory.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border)] p-3">
      <p className="mb-2 text-sm font-medium">{row.location.name}</p>
      {error && (
        <div className="mb-2">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <Field label="Quantity">
          <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <Field label="Low stock at">
          <Input type="number" value={lowStock} onChange={(e) => setLowStock(e.target.value)} />
        </Field>
        <Field label="Critical at">
          <Input type="number" value={criticalStock} onChange={(e) => setCriticalStock(e.target.value)} />
        </Field>
      </div>
      <div className="mt-2">
        <Button variant="secondary" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
