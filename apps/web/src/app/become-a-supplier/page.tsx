"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supplierSignupSchema } from "@autoparts/shared";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { Alert, Button, Card, Field, Input } from "../../components/ui";

const emptyForm = {
  legalBusinessName: "",
  tradingName: "",
  businessType: "",
  businessRegistrationNumber: "",
  physicalAddress: "",
  phone: "",
  email: "",
  website: "",
  authorizedRepresentativeName: "",
  password: "",
};

export default function BecomeSupplierPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof typeof emptyForm>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setErrors({});

    const parsed = supplierSignupSchema.safeParse({
      ...form,
      businessRegistrationNumber: form.businessRegistrationNumber || undefined,
      website: form.website || undefined,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as string] = issue.message;
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/auth/register/supplier", parsed.data);
      await refresh();
      router.push("/supplier");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-16">
      <h1 className="mb-2 text-2xl font-semibold">Become a supplier</h1>
      <p className="mb-8 text-sm text-[var(--muted)]">
        Every supplier is reviewed by our team before they can list products — this starts your application.
        You&apos;ll upload verification documents on the next screen.
      </p>
      <Card>
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {formError && (
            <div className="sm:col-span-2">
              <Alert variant="error">{formError}</Alert>
            </div>
          )}
          <Field label="Legal business name" error={errors.legalBusinessName}>
            <Input value={form.legalBusinessName} onChange={(e) => set("legalBusinessName", e.target.value)} />
          </Field>
          <Field label="Trading name" error={errors.tradingName}>
            <Input value={form.tradingName} onChange={(e) => set("tradingName", e.target.value)} />
          </Field>
          <Field label="Business type" error={errors.businessType}>
            <Input
              placeholder="e.g. Sole trader, Limited company"
              value={form.businessType}
              onChange={(e) => set("businessType", e.target.value)}
            />
          </Field>
          <Field label="Business registration number (optional)" error={errors.businessRegistrationNumber}>
            <Input
              value={form.businessRegistrationNumber}
              onChange={(e) => set("businessRegistrationNumber", e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Physical business address" error={errors.physicalAddress}>
              <Input value={form.physicalAddress} onChange={(e) => set("physicalAddress", e.target.value)} />
            </Field>
          </div>
          <Field label="Phone" error={errors.phone}>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Business email" error={errors.email}>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Website (optional)" error={errors.website}>
            <Input value={form.website} onChange={(e) => set("website", e.target.value)} />
          </Field>
          <Field label="Authorized representative name" error={errors.authorizedRepresentativeName}>
            <Input
              value={form.authorizedRepresentativeName}
              onChange={(e) => set("authorizedRepresentativeName", e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Choose a password for this account" error={errors.password}>
              <Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Starting application…" : "Start application"}
            </Button>
          </div>
        </form>
      </Card>
    </main>
  );
}
