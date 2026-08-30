"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { brand } from "@autoparts/shared";
import { Button } from "../components/ui";

type HealthState = { status: "checking" | "online" | "offline"; timestamp?: string };

export default function Home() {
  const [health, setHealth] = useState<HealthState>({ status: "checking" });

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
    fetch(`${apiUrl}/health`)
      .then((res) => res.json())
      .then((data) => setHealth({ status: "online", timestamp: data.timestamp }))
      .catch(() => setHealth({ status: "offline" }));
  }, []);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-wide text-[var(--muted)]">
        Phase 2 — working name
      </span>
      <h1 className="text-4xl font-semibold">{brand.appName}</h1>
      <p className="max-w-md text-[var(--muted)]">{brand.tagline}</p>
      <p className="max-w-md text-sm text-[var(--muted)]">
        The searchable marketplace is coming in a later build phase — for now, accounts, supplier applications, and
        admin review are live.
      </p>
      <div className="flex gap-3">
        <Link href="/signup">
          <Button>Create a customer account</Button>
        </Link>
        <Link href="/become-a-supplier">
          <Button variant="secondary">Become a supplier</Button>
        </Link>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span
          className={`h-2 w-2 rounded-full ${
            health.status === "online" ? "bg-green-500" : health.status === "offline" ? "bg-red-500" : "bg-yellow-500"
          }`}
        />
        <span className="text-[var(--muted)]">
          {health.status === "checking" && "Checking API connection…"}
          {health.status === "online" && `API connected (${health.timestamp})`}
          {health.status === "offline" && "API not reachable — start it with npm run dev in apps/api"}
        </span>
      </div>
    </main>
  );
}
