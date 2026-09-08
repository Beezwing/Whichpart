"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerCustomerSchema } from "@autoparts/shared";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { Alert, Button, Card, Field, Input } from "../../components/ui";

export default function SignupPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setErrors({});

    const parsed = registerCustomerSchema.safeParse({ ...form, phone: form.phone || undefined });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as string] = issue.message;
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/auth/register/customer", parsed.data);
      await refresh();
      router.push("/account");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-md flex-1 px-6 py-16">
      <h1 className="mb-2 text-2xl font-semibold">Create your account</h1>
      <p className="mb-8 text-sm text-[var(--muted)]">
        Free forever. Browse without one — you only need an account to check out, save vehicles, or message a
        supplier.
      </p>
      <Card>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {formError && <Alert variant="error">{formError}</Alert>}
          <Field label="Full name" error={errors.name}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email" error={errors.email}>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Phone (optional)" error={errors.phone}>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Password" error={errors.password}>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </Button>
          <p className="text-center text-xs text-[var(--muted)]">
            By creating an account you agree to our{" "}
            <Link href="/terms" className="text-[var(--accent)] hover:underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-[var(--accent)] hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </form>
      </Card>
      <p className="mt-6 text-center text-sm text-[var(--muted)]">
        Already have an account?{" "}
        <Link href="/login" className="text-[var(--accent)]">
          Log in
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-[var(--muted)]">
        Own an automotive business?{" "}
        <Link href="/become-a-supplier" className="text-[var(--accent)]">
          Apply as a supplier
        </Link>
      </p>
    </main>
  );
}
