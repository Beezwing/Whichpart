"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { Alert, Button, Card } from "../../../components/ui";
import { SupplierTabs } from "../../../components/supplier-tabs";

interface QuickBooksStatus {
  configured: boolean;
  connected: boolean;
  realmId: string | null;
  primaryLocationId: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  locations: { id: string; name: string }[];
}

export default function QuickBooksPage() {
  return (
    <Suspense fallback={<main className="flex-1 px-6 py-16 text-sm text-[var(--muted)]">Loading…</main>}>
      <QuickBooksPageInner />
    </Suspense>
  );
}

function QuickBooksPageInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<QuickBooksStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus(await api.get<QuickBooksStatus>("/quickbooks/status"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your QuickBooks settings.");
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

  // The OAuth callback redirects back here with ?quickbooks=connected|error
  // once Intuit's side of the flow finishes -- surface that as a one-time
  // banner, then drop it from the URL so a refresh doesn't repeat it.
  const callbackResult = params.get("quickbooks");
  useEffect(() => {
    if (!callbackResult) return;
    window.history.replaceState(null, "", "/supplier/quickbooks");
  }, [callbackResult]);

  async function connect() {
    setError(null);
    setConnecting(true);
    try {
      const { url } = await api.get<{ url: string }>("/quickbooks/connect");
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start the QuickBooks connection.");
      setConnecting(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect QuickBooks? Inventory will stop syncing until you reconnect.")) return;
    setError(null);
    try {
      await api.delete("/quickbooks/disconnect");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't disconnect QuickBooks.");
    }
  }

  async function setPrimaryLocation(locationId: string) {
    setSavingLocation(true);
    setError(null);
    try {
      await api.post("/quickbooks/primary-location", { locationId });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that location.");
    } finally {
      setSavingLocation(false);
    }
  }

  if (authLoading || loading) {
    return <main className="mx-auto max-w-2xl flex-1 px-6 py-16 text-sm text-[var(--muted)]">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-12">
      <h1 className="mb-2 text-2xl font-semibold">QuickBooks</h1>
      <SupplierTabs />

      {callbackResult === "connected" && (
        <div className="mb-4">
          <Alert variant="success">QuickBooks connected.</Alert>
        </div>
      )}
      {callbackResult === "error" && (
        <div className="mb-4">
          <Alert variant="error">Couldn&apos;t connect QuickBooks — please try again.</Alert>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {!status?.configured ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">
            QuickBooks sync isn&apos;t set up on Which Part? yet — check back soon.
          </p>
        </Card>
      ) : !status.connected ? (
        <Card>
          <p className="mb-4 text-sm text-[var(--muted)]">
            Connect your QuickBooks Online account so stock counts stay in sync automatically — update quantity in
            either place and the other follows, with no more manually updating both.
          </p>
          <Button onClick={() => void connect()} disabled={connecting}>
            {connecting ? "Redirecting…" : "Connect QuickBooks"}
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <p className="font-medium">Connected</p>
              <Button variant="secondary" onClick={() => void disconnect()}>
                Disconnect
              </Button>
            </div>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--muted)]">QuickBooks company</dt>
                <dd>{status.realmId}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--muted)]">Last synced</dt>
                <dd>{status.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleString() : "Not yet"}</dd>
              </div>
            </dl>
            {status.lastSyncError && (
              <div className="mt-4">
                <Alert variant="error">{status.lastSyncError}</Alert>
              </div>
            )}
          </Card>

          <Card>
            <p className="mb-1 font-medium">Primary location</p>
            <p className="mb-4 text-sm text-[var(--muted)]">
              QuickBooks tracks one quantity per item, not per location. When a change made directly in QuickBooks
              needs to land somewhere in Which Part?, it&apos;s applied here.
            </p>
            <select
              value={status.primaryLocationId ?? ""}
              onChange={(e) => void setPrimaryLocation(e.target.value)}
              disabled={savingLocation}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Choose a location
              </option>
              {status.locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Card>

          <Card>
            <p className="mb-1 font-medium">How matching works</p>
            <p className="text-sm text-[var(--muted)]">
              Products are matched to QuickBooks items automatically by SKU the first time their quantity changes
              here. Make sure a product&apos;s SKU in Which Part? matches its SKU in QuickBooks before updating its
              stock for the first time.
            </p>
          </Card>
        </div>
      )}
    </main>
  );
}
