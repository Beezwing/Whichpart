"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createMakeSchema, createModelSchema } from "@autoparts/shared";
import { api, ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { Alert, Button, Card, Field, Input } from "../../../components/ui";

interface Make {
  id: string;
  name: string;
}
interface Model {
  id: string;
  name: string;
  makeId: string;
}

export default function AdminVehiclesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [makes, setMakes] = useState<Make[]>([]);
  const [modelsByMake, setModelsByMake] = useState<Record<string, Model[]>>({});
  const [newMakeName, setNewMakeName] = useState("");
  const [newModelName, setNewModelName] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api.get<Make[]>("/vehicles/makes");
      setMakes(list);
      const entries = await Promise.all(
        list.map(async (m) => [m.id, await api.get<Model[]>(`/vehicles/models?makeId=${m.id}`)] as const),
      );
      setModelsByMake(Object.fromEntries(entries));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load vehicle data.");
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

  async function addMake(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = createMakeSchema.safeParse({ name: newMakeName });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your details.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/admin/vehicles/makes", parsed.data);
      setNewMakeName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add that make.");
    } finally {
      setBusy(false);
    }
  }

  async function addModel(makeId: string) {
    setError(null);
    const parsed = createModelSchema.safeParse({ makeId, name: newModelName[makeId] ?? "" });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your details.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/admin/vehicles/models", parsed.data);
      setNewModelName({ ...newModelName, [makeId]: "" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add that model.");
    } finally {
      setBusy(false);
    }
  }

  async function removeMake(id: string) {
    if (!confirm("Delete this make?")) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/admin/vehicles/makes/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete that make.");
    } finally {
      setBusy(false);
    }
  }

  async function removeModel(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/admin/vehicles/models/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete that model.");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading) return null;

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-12">
      <h1 className="mb-2 text-2xl font-semibold">Vehicle database</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">
        Makes and models used for search filters and the vehicle garage. Not exhaustive — add more as needed.
      </p>

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <Card className="mb-6">
        <form onSubmit={addMake} className="flex items-end gap-3">
          <Field label="Add a make">
            <Input value={newMakeName} onChange={(e) => setNewMakeName(e.target.value)} />
          </Field>
          <Button type="submit" disabled={busy || !newMakeName.trim()}>
            Add
          </Button>
        </form>
      </Card>

      <div className="flex flex-col gap-4">
        {makes.map((make) => (
          <Card key={make.id}>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-medium">{make.name}</p>
              <button className="text-xs text-red-600 hover:underline" disabled={busy} onClick={() => void removeMake(make.id)}>
                Delete make
              </button>
            </div>
            <ul className="mb-3 flex flex-wrap gap-2">
              {(modelsByMake[make.id] ?? []).map((model) => (
                <li
                  key={model.id}
                  className="flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs"
                >
                  {model.name}
                  <button className="text-red-600" disabled={busy} onClick={() => void removeModel(model.id)}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Input
                placeholder="Add a model"
                value={newModelName[make.id] ?? ""}
                onChange={(e) => setNewModelName({ ...newModelName, [make.id]: e.target.value })}
                className="max-w-xs"
              />
              <Button variant="secondary" disabled={busy} onClick={() => void addModel(make.id)}>
                Add model
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
