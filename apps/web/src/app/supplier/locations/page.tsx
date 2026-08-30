"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supplierLocationSchema, type DeliveryZone, type SupplierLocationInput } from "@autoparts/shared";
import { api, ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { Alert, Button, Card, Field, Input } from "../../../components/ui";
import { SupplierTabs } from "../../../components/supplier-tabs";

interface LocationRow extends SupplierLocationInput {
  id: string;
}

const emptyForm: SupplierLocationInput = {
  name: "",
  address: "",
  phone: "",
  openingHours: "",
  pickupAvailable: true,
  deliveryAvailable: false,
  deliveryZones: [],
};

export default function SupplierLocationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<SupplierLocationInput>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await api.get<LocationRow[]>("/suppliers/me/locations");
      setLocations(rows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your locations.");
    } finally {
      setLoading(false);
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

  function startEdit(row: LocationRow) {
    setForm({ ...row, deliveryZones: row.deliveryZones ?? [] });
    setFieldErrors({});
    setEditingId(row.id);
  }

  async function save() {
    const parsed = supplierLocationSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[issue.path[0] as string] = issue.message;
      setFieldErrors(errs);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editingId === "new") {
        await api.post("/suppliers/me/locations", parsed.data);
      } else if (editingId) {
        await api.patch(`/suppliers/me/locations/${editingId}`, parsed.data);
      }
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that location.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/suppliers/me/locations/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove that location.");
    } finally {
      setBusy(false);
    }
  }

  function updateZone(index: number, patch: Partial<DeliveryZone>) {
    const zones = [...(form.deliveryZones ?? [])];
    zones[index] = { ...zones[index], ...patch };
    setForm({ ...form, deliveryZones: zones });
  }

  function addZone() {
    setForm({ ...form, deliveryZones: [...(form.deliveryZones ?? []), { name: "", fee: 0 }] });
  }

  function removeZone(index: number) {
    setForm({ ...form, deliveryZones: (form.deliveryZones ?? []).filter((_, i) => i !== index) });
  }

  if (authLoading || loading) {
    return <main className="mx-auto max-w-2xl flex-1 px-6 py-12 text-sm text-[var(--muted)]">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-12">
      <h1 className="mb-2 text-2xl font-semibold">Locations</h1>
      <SupplierTabs />

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {locations.map((loc) =>
          editingId === loc.id ? (
            <LocationForm
              key={loc.id}
              form={form}
              setForm={setForm}
              errors={fieldErrors}
              busy={busy}
              onSave={save}
              onCancel={() => setEditingId(null)}
              onAddZone={addZone}
              onUpdateZone={updateZone}
              onRemoveZone={removeZone}
            />
          ) : (
            <Card key={loc.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{loc.name}</p>
                  <p className="text-sm text-[var(--muted)]">{loc.address}</p>
                  <div className="mt-2 flex gap-2 text-xs">
                    {loc.pickupAvailable && (
                      <span className="rounded-full bg-[var(--border)]/40 px-2 py-0.5">Pickup</span>
                    )}
                    {loc.deliveryAvailable && (
                      <span className="rounded-full bg-[var(--border)]/40 px-2 py-0.5">Delivery</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-3 text-xs">
                  <button className="text-[var(--accent)] hover:underline" onClick={() => startEdit(loc)}>
                    Edit
                  </button>
                  <button
                    className="text-red-600 hover:underline"
                    disabled={busy}
                    onClick={() => void remove(loc.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </Card>
          ),
        )}

        {editingId === "new" ? (
          <LocationForm
            form={form}
            setForm={setForm}
            errors={fieldErrors}
            busy={busy}
            onSave={save}
            onCancel={() => setEditingId(null)}
            onAddZone={addZone}
            onUpdateZone={updateZone}
            onRemoveZone={removeZone}
          />
        ) : (
          <Button variant="secondary" onClick={startCreate}>
            + Add a location
          </Button>
        )}
      </div>
    </main>
  );
}

function LocationForm({
  form,
  setForm,
  errors,
  busy,
  onSave,
  onCancel,
  onAddZone,
  onUpdateZone,
  onRemoveZone,
}: {
  form: SupplierLocationInput;
  setForm: (f: SupplierLocationInput) => void;
  errors: Record<string, string>;
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
  onAddZone: () => void;
  onUpdateZone: (index: number, patch: Partial<DeliveryZone>) => void;
  onRemoveZone: (index: number) => void;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-4">
        <Field label="Location name" error={errors.name}>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Address" error={errors.address}>
          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
        <Field label="Phone (optional)" error={errors.phone}>
          <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Opening hours (optional)" error={errors.openingHours}>
          <Input
            placeholder="e.g. Mon-Fri 8am-5pm, Sat 9am-1pm"
            value={form.openingHours ?? ""}
            onChange={(e) => setForm({ ...form, openingHours: e.target.value })}
          />
        </Field>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.pickupAvailable}
              onChange={(e) => setForm({ ...form, pickupAvailable: e.target.checked })}
            />
            Pickup available
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.deliveryAvailable}
              onChange={(e) => setForm({ ...form, deliveryAvailable: e.target.checked })}
            />
            Delivery available
          </label>
        </div>

        {form.deliveryAvailable && (
          <div className="rounded-lg border border-[var(--border)] p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Delivery zones</p>
            <div className="flex flex-col gap-2">
              {(form.deliveryZones ?? []).map((zone, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="Zone name"
                    value={zone.name}
                    onChange={(e) => onUpdateZone(i, { name: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Fee (JMD)"
                    value={zone.fee}
                    onChange={(e) => onUpdateZone(i, { fee: Number(e.target.value) })}
                  />
                  <Input
                    placeholder="Est. time"
                    value={zone.estimatedTime ?? ""}
                    onChange={(e) => onUpdateZone(i, { estimatedTime: e.target.value })}
                  />
                  <button className="text-xs text-red-600" onClick={() => onRemoveZone(i)}>
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" className="text-left text-xs text-[var(--accent)]" onClick={onAddZone}>
                + Add zone
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button disabled={busy} onClick={onSave}>
            Save location
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}
