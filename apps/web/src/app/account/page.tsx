"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { changePasswordSchema } from "@autoparts/shared";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { Alert, Button, Card, Field, Input } from "../../components/ui";
import { ProductTour } from "../../components/product-tour";
import { CUSTOMER_TOUR_ID, CUSTOMER_TOUR_STEPS } from "../../lib/tours";

const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: "Customer",
  SUPPLIER_OWNER: "Supplier owner",
  SUPPLIER_STAFF: "Supplier staff",
  SUPPLIER_LOCATION_MANAGER: "Location manager",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super admin",
};

export default function AccountPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" });
  const [status, setStatus] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.role === "CUSTOMER" && !user.toursSeen.includes(CUSTOMER_TOUR_ID)) {
      setShowTour(true);
    }
  }, [user]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const parsed = changePasswordSchema.safeParse(form);
    if (!parsed.success) {
      setStatus({ type: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." });
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/auth/password", parsed.data);
      setForm({ currentPassword: "", newPassword: "" });
      setStatus({ type: "success", message: "Password updated." });
    } catch (err) {
      setStatus({ type: "error", message: err instanceof ApiError ? err.message : "Something went wrong." });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return <main className="mx-auto max-w-md flex-1 px-6 py-16 text-sm text-[var(--muted)]">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-md flex-1 px-6 py-16">
      {showTour && (
        <ProductTour tourId={CUSTOMER_TOUR_ID} steps={CUSTOMER_TOUR_STEPS} onDone={() => setShowTour(false)} />
      )}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My account</h1>
        {user.role === "CUSTOMER" && (
          <button onClick={() => setShowTour(true)} className="text-sm text-[var(--accent)] hover:underline">
            Take the tour
          </button>
        )}
      </div>
      <Card className="mb-6">
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-[var(--muted)]">Name</dt>
            <dd>{user.customer?.name ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--muted)]">Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--muted)]">Role</dt>
            <dd>{ROLE_LABELS[user.role] ?? user.role}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-medium">Change password</h2>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {status && <Alert variant={status.type}>{status.message}</Alert>}
          <Field label="Current password">
            <Input
              type="password"
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            />
          </Field>
          <Field label="New password">
            <Input
              type="password"
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            />
          </Field>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Updating…" : "Update password"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
