"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createProductSchema } from "@autoparts/shared";
import { api, ApiError } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth-context";
import { flattenCategories, type CategoryNode } from "../../../../lib/categories";
import { Alert, Button, Card, Field, Input, Textarea } from "../../../../components/ui";

interface LocationOption {
  id: string;
  name: string;
}

const CONDITIONS = ["NEW", "USED", "REFURBISHED", "RECONDITIONED", "OEM", "AFTERMARKET"];

const emptyForm = {
  sku: "",
  name: "",
  description: "",
  categoryId: "",
  brand: "",
  condition: "USED",
  price: "",
  oemPartNumber: "",
  manufacturerPartNumber: "",
  requiresFreightQuote: false,
  locationId: "",
  quantity: "0",
  make: "",
  model: "",
  yearFrom: "",
  yearTo: "",
  engine: "",
  engineCode: "",
  transmission: "",
  compatNotes: "",
};

export default function NewProductPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [categories, setCategories] = useState<{ id: string; label: string }[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = useCallback(<K extends keyof typeof emptyForm>(key: K, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    void (async () => {
      const [tree, locs] = await Promise.all([
        api.get<CategoryNode[]>("/categories"),
        api.get<LocationOption[]>("/suppliers/me/locations"),
      ]);
      setCategories(flattenCategories(tree));
      setLocations(locs);
    })();
  }, [authLoading, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setErrors({});

    const hasCompatibility = Boolean(form.make || form.model || form.engine || form.compatNotes);
    const parsed = createProductSchema.safeParse({
      sku: form.sku,
      name: form.name,
      description: form.description || undefined,
      categoryId: form.categoryId || undefined,
      brand: form.brand || undefined,
      condition: form.condition,
      price: Number(form.price),
      oemPartNumber: form.oemPartNumber || undefined,
      manufacturerPartNumber: form.manufacturerPartNumber || undefined,
      requiresFreightQuote: form.requiresFreightQuote,
      locationId: form.locationId,
      quantity: Number(form.quantity),
      compatibility: hasCompatibility
        ? {
            make: form.make || undefined,
            model: form.model || undefined,
            yearFrom: form.yearFrom ? Number(form.yearFrom) : undefined,
            yearTo: form.yearTo ? Number(form.yearTo) : undefined,
            engine: form.engine || undefined,
            engineCode: form.engineCode || undefined,
            transmission: form.transmission || undefined,
            notes: form.compatNotes || undefined,
          }
        : undefined,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as string] = issue.message;
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const product = await api.post<{ id: string }>("/suppliers/me/products", parsed.data);
      router.push(`/supplier/products/${product.id}`);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't create this product.");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) return null;

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-12">
      <h1 className="mb-6 text-2xl font-semibold">New product</h1>

      {locations.length === 0 && (
        <Alert variant="error">
          You need at least one location before adding products —{" "}
          <a href="/supplier/locations" className="underline">
            create one first
          </a>
          .
        </Alert>
      )}

      <Card className="mt-4">
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {formError && (
            <div className="sm:col-span-2">
              <Alert variant="error">{formError}</Alert>
            </div>
          )}

          <Field label="Supplier SKU" error={errors.sku}>
            <Input value={form.sku} onChange={(e) => set("sku", e.target.value)} />
          </Field>
          <Field label="Product name" error={errors.name}>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description" error={errors.description}>
              <Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
          </div>
          <Field label="Category">
            <select
              value={form.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              <option value="">Uncategorized (AI may suggest one)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Brand">
            <Input value={form.brand} onChange={(e) => set("brand", e.target.value)} />
          </Field>
          <Field label="Condition" error={errors.condition}>
            <select
              value={form.condition}
              onChange={(e) => set("condition", e.target.value)}
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
            <Input type="number" value={form.price} onChange={(e) => set("price", e.target.value)} />
          </Field>
          <Field label="OEM part number">
            <Input value={form.oemPartNumber} onChange={(e) => set("oemPartNumber", e.target.value)} />
          </Field>
          <Field label="Manufacturer part number">
            <Input
              value={form.manufacturerPartNumber}
              onChange={(e) => set("manufacturerPartNumber", e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={form.requiresFreightQuote}
                onChange={(e) => setForm((f) => ({ ...f, requiresFreightQuote: e.target.checked }))}
              />
              <span>
                Requires a manual freight quote
                <span className="block text-xs text-[var(--muted)]">
                  Oversized/heavy — complete engines, engine blocks. Customers can only pick this up or contact you
                  to arrange delivery; it won&apos;t use your flat delivery zone fees.
                </span>
              </span>
            </label>
          </div>
          <Field label="Location" error={errors.locationId}>
            <select
              value={form.locationId}
              onChange={(e) => set("locationId", e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              <option value="">Select a location</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantity in stock" error={errors.quantity}>
            <Input type="number" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
          </Field>

          <div className="sm:col-span-2">
            <p className="mb-2 mt-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Vehicle compatibility (optional)
            </p>
          </div>
          <Field label="Make">
            <Input value={form.make} onChange={(e) => set("make", e.target.value)} />
          </Field>
          <Field label="Model">
            <Input value={form.model} onChange={(e) => set("model", e.target.value)} />
          </Field>
          <Field label="Year from">
            <Input type="number" value={form.yearFrom} onChange={(e) => set("yearFrom", e.target.value)} />
          </Field>
          <Field label="Year to">
            <Input type="number" value={form.yearTo} onChange={(e) => set("yearTo", e.target.value)} />
          </Field>
          <Field label="Engine">
            <Input value={form.engine} onChange={(e) => set("engine", e.target.value)} />
          </Field>
          <Field label="Engine code">
            <Input value={form.engineCode} onChange={(e) => set("engineCode", e.target.value)} />
          </Field>
          <Field label="Transmission">
            <Input value={form.transmission} onChange={(e) => set("transmission", e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Compatibility notes">
              <Textarea rows={2} value={form.compatNotes} onChange={(e) => set("compatNotes", e.target.value)} />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Button type="submit" disabled={submitting || locations.length === 0}>
              {submitting ? "Creating…" : "Create product"}
            </Button>
          </div>
        </form>
      </Card>
    </main>
  );
}
