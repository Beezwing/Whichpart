"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError, apiUrl } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth-context";
import { Alert, Badge, Button, Card, Textarea } from "../../../../components/ui";

interface SupplierDetail {
  supplier: {
    id: string;
    tradingName: string;
    legalBusinessName: string;
    businessType: string;
    businessRegistrationNumber: string | null;
    physicalAddress: string;
    phone: string;
    email: string;
    website: string | null;
    authorizedRepresentativeName: string;
    verificationStatus: string;
    verifications: { documents: { id: string; documentType: string; uploadedAt: string }[] }[];
  };
  history: {
    id: string;
    action: string;
    createdAt: string;
    metadata: Record<string, unknown> | null;
    actor: { email: string } | null;
  }[];
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

type ReasonAction = "reject" | "request-info" | "suspend" | "note" | null;

export default function AdminSupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<SupplierDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reasonAction, setReasonAction] = useState<ReasonAction>(null);
  const [reasonText, setReasonText] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.get<SupplierDetail>(`/admin/suppliers/${id}`);
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load this supplier.");
    }
  }, [id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      router.push("/login");
      return;
    }
    void load();
  }, [authLoading, user, router, load]);

  async function runAction(path: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/admin/suppliers/${id}/${path}`, body);
      setReasonAction(null);
      setReasonText("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That action failed.");
    } finally {
      setBusy(false);
    }
  }

  function submitReason() {
    if (!reasonText.trim()) return;
    if (reasonAction === "reject") void runAction("reject", { reason: reasonText });
    if (reasonAction === "request-info") void runAction("request-info", { message: reasonText });
    if (reasonAction === "suspend") void runAction("suspend", { reason: reasonText });
    if (reasonAction === "note") void runAction("notes", { note: reasonText });
  }

  if (authLoading || !data) {
    return (
      <main className="mx-auto max-w-3xl flex-1 px-6 py-12">
        {error ? <Alert variant="error">{error}</Alert> : <p className="text-sm text-[var(--muted)]">Loading…</p>}
      </main>
    );
  }

  const { supplier, history } = data;
  const status = supplier.verificationStatus;
  const documents = supplier.verifications[0]?.documents ?? [];

  return (
    <main className="mx-auto max-w-3xl flex-1 px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{supplier.tradingName}</h1>
          <p className="text-sm text-[var(--muted)]">{supplier.legalBusinessName}</p>
        </div>
        <Badge tone={STATUS_TONE[status] ?? "neutral"}>{status.replaceAll("_", " ")}</Badge>
      </div>

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <Card className="mb-6">
        <h2 className="mb-3 text-lg font-medium">Business details</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Detail label="Business type" value={supplier.businessType} />
          <Detail label="Registration #" value={supplier.businessRegistrationNumber ?? "—"} />
          <Detail label="Phone" value={supplier.phone} />
          <Detail label="Email" value={supplier.email} />
          <Detail label="Website" value={supplier.website ?? "—"} />
          <Detail label="Representative" value={supplier.authorizedRepresentativeName} />
          <Detail label="Address" value={supplier.physicalAddress} full />
        </dl>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-3 text-lg font-medium">Documents</h2>
        {documents.length === 0 && <p className="text-sm text-[var(--muted)]">No documents uploaded.</p>}
        <ul className="flex flex-col gap-2">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
              <span>{DOCUMENT_LABELS[doc.documentType] ?? doc.documentType}</span>
              <a
                href={`${apiUrl}/suppliers/documents/${doc.id}/file`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[var(--accent)] hover:underline"
              >
                View
              </a>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-3 text-lg font-medium">Actions</h2>
        <div className="flex flex-wrap gap-2">
          {(status === "SUBMITTED" || status === "ADDITIONAL_INFO_REQUIRED") && (
            <Button variant="secondary" disabled={busy} onClick={() => void runAction("start-review")}>
              Start review
            </Button>
          )}
          {(status === "SUBMITTED" || status === "UNDER_REVIEW" || status === "ADDITIONAL_INFO_REQUIRED") && (
            <Button disabled={busy} onClick={() => void runAction("approve")}>
              Approve
            </Button>
          )}
          {(status === "SUBMITTED" || status === "UNDER_REVIEW") && (
            <Button variant="secondary" disabled={busy} onClick={() => setReasonAction("request-info")}>
              Request more info
            </Button>
          )}
          {(status === "SUBMITTED" || status === "UNDER_REVIEW" || status === "ADDITIONAL_INFO_REQUIRED") && (
            <Button variant="danger" disabled={busy} onClick={() => setReasonAction("reject")}>
              Reject
            </Button>
          )}
          {status === "APPROVED" && (
            <Button variant="danger" disabled={busy} onClick={() => setReasonAction("suspend")}>
              Suspend
            </Button>
          )}
          {status === "SUSPENDED" && (
            <Button disabled={busy} onClick={() => void runAction("reactivate")}>
              Reactivate
            </Button>
          )}
          <Button variant="secondary" disabled={busy} onClick={() => setReasonAction("note")}>
            Add internal note
          </Button>
        </div>

        {reasonAction && (
          <div className="mt-4 flex flex-col gap-2 border-t border-[var(--border)] pt-4">
            <Textarea
              rows={3}
              placeholder={
                reasonAction === "note"
                  ? "Internal note (not visible to the supplier)"
                  : "Explain why — this is sent to the supplier"
              }
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
            />
            <div className="flex gap-2">
              <Button disabled={busy || !reasonText.trim()} onClick={submitReason}>
                Confirm
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setReasonAction(null);
                  setReasonText("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-medium">History</h2>
        <ul className="flex flex-col gap-3">
          {history.length === 0 && <li className="text-sm text-[var(--muted)]">No activity yet.</li>}
          {history.map((entry) => (
            <li key={entry.id} className="border-l-2 border-[var(--border)] pl-3 text-sm">
              <p className="font-medium">{entry.action.replaceAll("_", " ")}</p>
              {entry.metadata && typeof entry.metadata === "object" && "note" in entry.metadata && (
                <p className="text-[var(--muted)]">{String(entry.metadata.note)}</p>
              )}
              {entry.metadata && typeof entry.metadata === "object" && "reason" in entry.metadata && (
                <p className="text-[var(--muted)]">{String(entry.metadata.reason)}</p>
              )}
              {entry.metadata && typeof entry.metadata === "object" && "message" in entry.metadata && (
                <p className="text-[var(--muted)]">{String(entry.metadata.message)}</p>
              )}
              <p className="text-xs text-[var(--muted)]">
                {entry.actor?.email ?? "System"} · {new Date(entry.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}

function Detail({ label, value, full = false }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : undefined}>
      <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
