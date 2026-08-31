"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { savedVehicleSchema, type SavedVehicleInput } from "@autoparts/shared";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { Alert, Button, Card, Field, Input } from "../../components/ui";

interface SavedVehicle extends SavedVehicleInput {
  id: string;
}

const emptyForm: SavedVehicleInput = {
  nickname: "",
  make: "",
  model: "",
  year: new Date().getFullYear(),
  transmission: "",
  mileage: undefined,
  notes: "",
  vin: "",
  chassisNumber: "",
  engineNumber: "",
  engineCode: "",
};

export default function GaragePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<SavedVehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<SavedVehicleInput>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setVehicles(await api.get<SavedVehicle[]>("/garage"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your garage.");
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    void load();
  }, [authLoading, user, router, load]);

  function startCreate() {
    setForm(emptyForm);
    setFieldErrors({});
    setEditingId("new");
  }
  function startEdit(v: SavedVehicle) {
    setForm(v);
    setFieldErrors({});
    setEditingId(v.id);
  }

  function cleanForm(f: SavedVehicleInput) {
    return {
      ...f,
      nickname: f.nickname || undefined,
      transmission: f.transmission || undefined,
      notes: f.notes || undefined,
      vin: f.vin || undefined,
      chassisNumber: f.chassisNumber || undefined,
      engineNumber: f.engineNumber || undefined,
      engineCode: f.engineCode || undefined,
      mileage: f.mileage || undefined,
    };
  }

  async function save() {
    const parsed = savedVehicleSchema.safeParse(cleanForm(form));
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[issue.path[0] as string] = issue.message;
      setFieldErrors(errs);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editingId === "new") await api.post("/garage", parsed.data);
      else if (editingId) await api.patch(`/garage/${editingId}`, parsed.data);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this vehicle.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this vehicle from your garage?")) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/garage/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove this vehicle.");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading) return null;

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-12">
      <h1 className="mb-6 text-2xl font-semibold">My Garage</h1>

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {vehicles.map((v) =>
          editingId === v.id ? (
            <VehicleForm
              key={v.id}
              form={form}
              setForm={setForm}
              errors={fieldErrors}
              busy={busy}
              onSave={save}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <Card key={v.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {v.nickname ? `${v.nickname} — ` : ""}
                  {v.year} {v.make} {v.model}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {[v.vin && `VIN ${v.vin}`, v.chassisNumber && `Chassis ${v.chassisNumber}`, v.engineCode && `Engine ${v.engineCode}`]
                    .filter(Boolean)
                    .join(" · ") || "No identifiers saved"}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Link
                  href={`/search?make=${encodeURIComponent(v.make)}&model=${encodeURIComponent(v.model)}&year=${v.year}`}
                  className="text-[var(--accent)] hover:underline"
                >
                  Find parts
                </Link>
                <button className="text-[var(--muted)] hover:underline" onClick={() => startEdit(v)}>
                  Edit
                </button>
                <button className="text-red-600 hover:underline" disabled={busy} onClick={() => void remove(v.id)}>
                  Remove
                </button>
              </div>
            </Card>
          ),
        )}

        {editingId === "new" ? (
          <VehicleForm
            form={form}
            setForm={setForm}
            errors={fieldErrors}
            busy={busy}
            onSave={save}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <Button variant="secondary" onClick={startCreate}>
            + Add a vehicle
          </Button>
        )}
      </div>
    </main>
  );
}

function VehicleForm({
  form,
  setForm,
  errors,
  busy,
  onSave,
  onCancel,
}: {
  form: SavedVehicleInput;
  setForm: (f: SavedVehicleInput) => void;
  errors: Record<string, string>;
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <Card>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nickname (optional)">
          <Input value={form.nickname ?? ""} onChange={(e) => setForm({ ...form, nickname: e.target.value })} />
        </Field>
        <div />
        <Field label="Make" error={errors.make}>
          <Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} />
        </Field>
        <Field label="Model" error={errors.model}>
          <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
        </Field>
        <Field label="Year" error={errors.year}>
          <Input
            type="number"
            value={form.year}
            onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
          />
        </Field>
        <Field label="Transmission (optional)">
          <Input
            value={form.transmission ?? ""}
            onChange={(e) => setForm({ ...form, transmission: e.target.value })}
          />
        </Field>
        <Field label="VIN (optional)" error={errors.vin}>
          <Input value={form.vin ?? ""} onChange={(e) => setForm({ ...form, vin: e.target.value })} />
        </Field>
        <Field label="Chassis number (optional)" error={errors.chassisNumber}>
          <Input
            value={form.chassisNumber ?? ""}
            onChange={(e) => setForm({ ...form, chassisNumber: e.target.value })}
          />
        </Field>
        <Field label="Engine number (optional)" error={errors.engineNumber}>
          <Input
            value={form.engineNumber ?? ""}
            onChange={(e) => setForm({ ...form, engineNumber: e.target.value })}
          />
        </Field>
        <Field label="Engine code (optional)" error={errors.engineCode}>
          <Input
            value={form.engineCode ?? ""}
            onChange={(e) => setForm({ ...form, engineCode: e.target.value })}
          />
        </Field>
        <Field label="Mileage (optional)">
          <Input
            type="number"
            value={form.mileage ?? ""}
            onChange={(e) => setForm({ ...form, mileage: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes (optional)">
            <Input value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <Button disabled={busy} onClick={onSave}>
            Save vehicle
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}
