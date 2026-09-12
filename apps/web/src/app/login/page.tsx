"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { loginSchema } from "@autoparts/shared";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { landingPathFor } from "../../components/nav-bar";
import { Alert, Button, Card, Field, Input } from "../../components/ui";
import type { CurrentUser } from "../../lib/auth-context";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="flex-1 px-6 py-16 text-sm text-[var(--muted)]">Loading…</main>}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your details.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/auth/login", parsed.data);
      const me = await api.get<CurrentUser>("/auth/me");
      await refresh();
      const next = params.get("next");
      router.push(next && next.startsWith("/") ? next : landingPathFor(me.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-md flex-1 px-6 py-16">
      <h1 className="mb-8 text-2xl font-semibold">Log in</h1>
      <Card>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {error && <Alert variant="error">{error}</Alert>}
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Logging in…" : "Log in"}
          </Button>
        </form>
      </Card>
      <p className="mt-6 text-center text-sm text-[var(--muted)]">
        New here?{" "}
        <Link href="/signup" className="text-[var(--accent)]">
          Create a customer account
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-[var(--muted)]">
        Selling auto parts?{" "}
        <Link href="/become-a-supplier" className="text-[var(--accent)]">
          Register as a supplier
        </Link>
      </p>
    </main>
  );
}
