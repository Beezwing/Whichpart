"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";
import { Card } from "../../components/ui";
import type { CategoryNode } from "../../lib/categories";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryNode[]>([]);

  useEffect(() => {
    void api.get<CategoryNode[]>("/categories").then(setCategories);
  }, []);

  return (
    <main className="mx-auto max-w-4xl flex-1 px-6 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Browse by category</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {categories.map((c) => (
          <Link key={c.id} href={`/search?categoryId=${c.id}`}>
            <Card className="hover:border-[var(--accent)]">
              <p className="font-medium">{c.name}</p>
              {c.children.length > 0 && (
                <p className="mt-1 text-xs text-[var(--muted)]">{c.children.map((child) => child.name).join(", ")}</p>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
