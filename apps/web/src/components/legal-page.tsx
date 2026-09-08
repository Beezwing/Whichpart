import type { ReactNode } from "react";
import { Alert } from "./ui";

export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl flex-1 px-6 py-12">
      <h1 className="mb-1 text-2xl font-semibold">{title}</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">Last updated {lastUpdated}</p>
      <div className="mb-6">
        <Alert variant="info">
          This is a plain-language draft, not legal advice — it hasn&apos;t been reviewed by a Jamaican attorney.
          Treat it as a real starting point for a pilot with a small number of suppliers, and have it properly
          reviewed before relying on it at a larger scale.
        </Alert>
      </div>
      <div className="flex flex-col gap-6 text-sm leading-relaxed text-[var(--foreground)] [&_h2]:mt-2 [&_h2]:text-lg [&_h2]:font-medium [&_p]:text-[var(--muted)] [&_li]:text-[var(--muted)] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
        {children}
      </div>
    </main>
  );
}
