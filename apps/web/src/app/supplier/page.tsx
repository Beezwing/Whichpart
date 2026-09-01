"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { documentTypes, updateSupplierProfileSchema } from "@autoparts/shared";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { Alert, Badge, Button, Card, Field, Input, Textarea } from "../../components/ui";
import { SupplierTabs } from "../../components/supplier-tabs";

interface SupplierDocument {
  id: string;
  documentType: string;
  uploadedAt: string;
}
interface SupplierMe {
  id: string;
  tradingName: string;
  legalBusinessName: string;
  phone: string;
  website: string | null;
  physicalAddress: string;
  description: string | null;
  verificationStatus: string;
  verification: { id: string; status: string; documents: SupplierDocument[] } | null;
}
interface NotificationRow {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

const DOCUMENT_LABELS: Record<string, string> = {
  BUSINESS_REGISTRATION: "Proof of business registration",
  REPRESENTATIVE_ID: "Representative ID",
  OTHER: "Other document",
};

const STATUS_TONE: Record<string, "neutral" | "good" | "warn" | "bad"> = {
  DRAFT: "neutral",
  SUBMITTED: "warn",
  UNDER_REVIEW: "warn",
  ADDITIONAL_INFO_REQUIRED: "bad",
  APPROVED: "good",
  REJECTED: "bad",
  SUSPENDED: "bad",
  DEACTIVATED: "neutral",
};

const EDITABLE_STATUSES = ["DRAFT", "ADDITIONAL_INFO_REQUIRED"];

export default function SupplierPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [supplier, setSupplier] = useState<SupplierMe | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<string>(documentTypes[0]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [me, notes] = await Promise.all([
        api.get<SupplierMe>("/suppliers/me"),
        api.get<NotificationRow[]>("/notifications/me"),
      ]);
      setSupplier(me);
      setNotifications(notes.slice(0, 3));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your supplier account.");
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

  async function uploadDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("documentType", documentType);
      await api.postForm("/suppliers/me/documents", form);
      setFile(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed.");
      setBusy(false);
      return;
    }
    await reloadAfterAction();
  }

  async function removeDocument(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/suppliers/me/documents/${id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove that document.");
      setBusy(false);
      return;
    }
    await reloadAfterAction();
  }

  async function submitApplication() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/suppliers/me/submit");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit your application.");
      setBusy(false);
      return;
    }
    await reloadAfterAction();
  }

  /**
   * The action above already succeeded — a failure here just means the
   * page couldn't refresh itself, never that the action failed. Reflecting
   * that mistakenly would tell the supplier something didn't happen when
   * it did (Section 65: errors must describe what actually went wrong).
   */
  async function reloadAfterAction() {
    try {
      await load();
    } catch {
      setError("That worked, but the page couldn't refresh — reload to see the latest status.");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || loading) {
    return <main className="mx-auto max-w-2xl flex-1 px-6 py-16 text-sm text-[var(--muted)]">Loading…</main>;
  }
  if (!supplier) {
    return (
      <main className="mx-auto max-w-2xl flex-1 px-6 py-16">
        <Alert variant="error">{error ?? "No supplier account found."}</Alert>
      </main>
    );
  }

  const status = supplier.verificationStatus;

  if (status === "APPROVED" || status === "SUSPENDED") {
    return (
      <ApprovedOverview
        supplier={supplier}
        notifications={notifications}
        error={error}
        onProfileSaved={load}
      />
    );
  }

  const documents = supplier.verification?.documents ?? [];
  const hasRegistration = documents.some((d) => d.documentType === documentTypes[0]);
  const editable = EDITABLE_STATUSES.includes(status);

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-16">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{supplier.tradingName}</h1>
        <Badge tone={STATUS_TONE[status] ?? "neutral"}>{status.replaceAll("_", " ")}</Badge>
      </div>

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {(status === "SUBMITTED" || status === "UNDER_REVIEW") && (
        <Alert variant="info">Your application is with our team for review. We&apos;ll notify you here.</Alert>
      )}
      {status === "REJECTED" && (
        <Alert variant="error">Your application was not approved. See the note below for details.</Alert>
      )}
      {status === "ADDITIONAL_INFO_REQUIRED" && (
        <Alert variant="error">We need more information before we can continue reviewing your application.</Alert>
      )}

      {notifications.length > 0 && (
        <div className="mt-6 flex flex-col gap-2">
          {notifications.map((n) => (
            <Card key={n.id} className="p-4">
              <p className="text-sm font-medium">{n.title}</p>
              <p className="text-sm text-[var(--muted)]">{n.body}</p>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-6">
        <h2 className="mb-4 text-lg font-medium">Verification documents</h2>
        <ul className="mb-4 flex flex-col gap-2">
          {documents.length === 0 && <li className="text-sm text-[var(--muted)]">No documents uploaded yet.</li>}
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
              <span>{DOCUMENT_LABELS[doc.documentType] ?? doc.documentType}</span>
              {editable && (
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline"
                  disabled={busy}
                  onClick={() => void removeDocument(doc.id)}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>

        {editable && (
          <form onSubmit={uploadDocument} className="flex flex-col gap-3 border-t border-[var(--border)] pt-4">
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              {documentTypes.map((type) => (
                <option key={type} value={type}>
                  {DOCUMENT_LABELS[type]}
                </option>
              ))}
            </select>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            <Button type="submit" variant="secondary" disabled={!file || busy}>
              Upload document
            </Button>
          </form>
        )}
      </Card>

      {editable && (
        <div className="mt-6">
          <Button onClick={() => void submitApplication()} disabled={!hasRegistration || busy}>
            Submit application for review
          </Button>
          {!hasRegistration && (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Upload proof of business registration before submitting.
            </p>
          )}
        </div>
      )}
    </main>
  );
}

function ApprovedOverview({
  supplier,
  notifications,
  error,
  onProfileSaved,
}: {
  supplier: SupplierMe;
  notifications: NotificationRow[];
  error: string | null;
  onProfileSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    tradingName: supplier.tradingName,
    phone: supplier.phone,
    website: supplier.website ?? "",
    physicalAddress: supplier.physicalAddress,
    description: supplier.description ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setErrors({});
    const parsed = updateSupplierProfileSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as string] = issue.message;
      setErrors(fieldErrors);
      return;
    }
    setSaving(true);
    try {
      await api.patch("/suppliers/me", parsed.data);
      setStatus({ type: "success", message: "Saved." });
      await onProfileSaved();
    } catch (err) {
      setStatus({ type: "error", message: err instanceof ApiError ? err.message : "Couldn't save your changes." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-12">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{supplier.tradingName}</h1>
        <Badge tone={STATUS_TONE[supplier.verificationStatus] ?? "neutral"}>
          {supplier.verificationStatus.replaceAll("_", " ")}
        </Badge>
      </div>
      <SupplierTabs />

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
      {supplier.verificationStatus === "SUSPENDED" && (
        <div className="mb-4">
          <Alert variant="error">
            Your supplier account is suspended — your listings are hidden from customers until this is resolved.
          </Alert>
        </div>
      )}

      {notifications.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          {notifications.map((n) => (
            <Card key={n.id} className="p-4">
              <p className="text-sm font-medium">{n.title}</p>
              <p className="text-sm text-[var(--muted)]">{n.body}</p>
            </Card>
          ))}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryLink href="/supplier/products" label="Products" />
        <SummaryLink href="/supplier/locations" label="Locations" />
        <SummaryLink href="/supplier/subscription" label="Subscription" />
        <SummaryLink href="/supplier/payment" label="Payment" />
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-medium">Business information</h2>
        <p className="mb-4 text-xs text-[var(--muted)]">
          Legal business name and registration number are locked after verification — contact support to change
          those.
        </p>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {status && <Alert variant={status.type}>{status.message}</Alert>}
          <Field label="Trading name" error={errors.tradingName}>
            <Input value={form.tradingName} onChange={(e) => setForm({ ...form, tradingName: e.target.value })} />
          </Field>
          <Field label="Phone" error={errors.phone}>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Website" error={errors.website}>
            <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          </Field>
          <Field label="Physical address" error={errors.physicalAddress}>
            <Input
              value={form.physicalAddress}
              onChange={(e) => setForm({ ...form, physicalAddress: e.target.value })}
            />
          </Field>
          <Field label="Description (shown on your public profile)" error={errors.description}>
            <Textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Card>
    </main>
  );
}

function SummaryLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm font-medium hover:border-[var(--accent)]"
    >
      {label} →
    </Link>
  );
}
