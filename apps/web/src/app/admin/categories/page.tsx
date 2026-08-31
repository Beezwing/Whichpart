"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createCategorySchema } from "@autoparts/shared";
import { api, ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { flattenCategories, type CategoryNode } from "../../../lib/categories";
import { Alert, Button, Card, Field, Input } from "../../../components/ui";

export default function AdminCategoriesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setTree(await api.get<CategoryNode[]>("/categories"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load categories.");
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

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = createCategorySchema.safeParse({ name, parentId: parentId || undefined });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your details.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/admin/categories", parsed.data);
      setName("");
      setParentId("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add that category.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this category?")) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/admin/categories/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete that category.");
    } finally {
      setBusy(false);
    }
  }

  const flat = flattenCategories(tree);

  if (authLoading) return null;

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Categories</h1>

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <Card className="mb-6">
        <h2 className="mb-3 text-lg font-medium">Add a category</h2>
        <form onSubmit={addCategory} className="flex flex-wrap items-end gap-3">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Parent (optional)">
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              <option value="">Top-level category</option>
              {flat.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" disabled={busy || !name.trim()}>
            Add
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-medium">All categories</h2>
        <ul className="flex flex-col gap-1">
          {flat.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--border)]/20">
              <span>{c.label}</span>
              <button className="text-xs text-red-600 hover:underline" disabled={busy} onClick={() => void remove(c.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
