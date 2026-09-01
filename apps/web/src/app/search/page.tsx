"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, apiUrl } from "../../lib/api";
import { Badge, Button, Card, Input } from "../../components/ui";

interface Make {
  id: string;
  name: string;
}
interface Model {
  id: string;
  name: string;
}
interface CategoryOption {
  id: string;
  name: string;
}
interface SearchLocation {
  id: string;
  name: string;
  quantity: number;
  pickupAvailable: boolean;
  deliveryAvailable: boolean;
  distanceKm: number | null;
}
interface SearchResult {
  id: string;
  sku: string;
  name: string;
  condition: string;
  price: string;
  currency: string;
  category: { id: string; name: string } | null;
  imageUrl: string | null;
  supplier: { id: string; tradingName: string; verificationStatus: string };
  totalQuantity: number;
  locations: SearchLocation[];
}

const CONDITIONS = ["NEW", "USED", "REFURBISHED", "RECONDITIONED", "OEM", "AFTERMARKET"];

export default function SearchPage() {
  return (
    <Suspense fallback={<main className="flex-1 px-6 py-12 text-sm text-[var(--muted)]">Loading…</main>}>
      <SearchPageInner />
    </Suspense>
  );
}

function SearchPageInner() {
  const params = useSearchParams();
  const router = useRouter();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [make, setMake] = useState(params.get("make") ?? "");
  const [model, setModel] = useState(params.get("model") ?? "");
  const [year, setYear] = useState(params.get("year") ?? "");
  const [categoryId, setCategoryId] = useState(params.get("categoryId") ?? "");
  const [condition, setCondition] = useState(params.get("condition") ?? "");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("relevance");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [makes, setMakes] = useState<Make[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void api.get<Make[]>("/vehicles/makes").then(setMakes);
    void api
      .get<{ id: string; name: string; children: { id: string; name: string }[] }[]>("/categories")
      .then((tree) => setCategories(tree.flatMap((c) => [{ id: c.id, name: c.name }, ...c.children])));
  }, []);

  useEffect(() => {
    if (!make) {
      setModels([]);
      return;
    }
    const makeId = makes.find((m) => m.name === make)?.id;
    if (!makeId) return;
    void api.get<Model[]>(`/vehicles/models?makeId=${makeId}`).then(setModels);
  }, [make, makes]);

  const runSearch = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      if (make) p.set("make", make);
      if (model) p.set("model", model);
      if (year) p.set("year", year);
      if (categoryId) p.set("categoryId", categoryId);
      if (condition) p.set("condition", condition);
      if (minPrice) p.set("minPrice", minPrice);
      if (maxPrice) p.set("maxPrice", maxPrice);
      if (coords) {
        p.set("lat", String(coords.lat));
        p.set("lng", String(coords.lng));
      }
      p.set("sort", sort);
      p.set("page", String(targetPage));
      try {
        const res = await api.get<{ items: SearchResult[]; total: number }>(`/search/products?${p.toString()}`);
        setResults(res.items);
        setTotal(res.total);
        setPage(targetPage);
      } finally {
        setLoading(false);
      }
    },
    [q, make, model, year, categoryId, condition, minPrice, maxPrice, sort, coords],
  );

  useEffect(() => {
    void runSearch(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (make) p.set("make", make);
    if (model) p.set("model", model);
    if (year) p.set("year", year);
    router.replace(`/search?${p.toString()}`);
    void runSearch(1);
  }

  const pageCount = Math.max(1, Math.ceil(total / 20));

  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Search parts</h1>

      <form onSubmit={onSubmit} className="mb-6 flex flex-col gap-4 rounded-xl border border-[var(--border)] p-4">
        <div className="flex gap-2">
          <Input
            placeholder="Part name, OEM number, SKU, chassis number…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1"
          />
          <Button type="submit">Search</Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <select
            value={make}
            onChange={(e) => {
              setMake(e.target.value);
              setModel("");
            }}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          >
            <option value="">Any make</option>
            {makes.map((m) => (
              <option key={m.id} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={!make}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          >
            <option value="">Any model</option>
            {models.map((m) => (
              <option key={m.id} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
          <Input placeholder="Year" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          >
            <option value="">Any category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          >
            <option value="">Any condition</option>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Input placeholder="Min price" type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
          <Input placeholder="Max price" type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          >
            <option value="relevance">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            {coords && <option value="distance">Nearest to me</option>}
          </select>
        </div>
        <div>
          <button type="button" onClick={useMyLocation} className="text-xs text-[var(--accent)] hover:underline">
            {coords ? "Location set — sort by distance available" : "Use my location for distance/nearest sorting"}
          </button>
        </div>
        <div>
          <Button type="submit" variant="secondary" disabled={loading}>
            Apply filters
          </Button>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Searching…</p>
      ) : results.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">No parts matched your search yet.</p>
        </Card>
      ) : (
        <>
          <p className="mb-3 text-xs text-[var(--muted)]">{total} result{total === 1 ? "" : "s"}</p>
          <div className="flex flex-col gap-3">
            {results.map((r) => (
              <Card key={r.id} className="flex gap-4">
                <Link href={`/product/${r.id}`} className="shrink-0">
                  {r.imageUrl && (
                    <img
                      src={`${apiUrl}/products/images/${r.imageUrl}/file`}
                      alt=""
                      className="hidden h-20 w-20 rounded-lg object-cover sm:block"
                    />
                  )}
                </Link>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <Link href={`/product/${r.id}`} className="font-medium hover:underline">
                        {r.name}
                      </Link>
                      <p className="text-xs text-[var(--muted)]">
                        {r.condition} · {r.category?.name ?? "Uncategorized"} · SKU {r.sku}
                      </p>
                    </div>
                    <p className="text-lg font-semibold">
                      ${Number(r.price).toLocaleString()} <span className="text-xs font-normal">{r.currency}</span>
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <Link href={`/suppliers/${r.supplier.id}`} className="font-medium hover:underline">
                      {r.supplier.tradingName}
                    </Link>
                    {r.supplier.verificationStatus === "APPROVED" && <Badge tone="good">Verified Supplier</Badge>}
                    <span className="text-[var(--muted)]">
                      {r.totalQuantity > 0 ? `${r.totalQuantity} available` : "Out of stock"}
                    </span>
                    {r.locations.map((loc) => (
                      <span key={loc.id} className="text-[var(--muted)]">
                        {loc.name}
                        {loc.pickupAvailable && " · Pickup"}
                        {loc.deliveryAvailable && " · Delivery"}
                        {loc.distanceKm != null && ` · ${loc.distanceKm}km away`}
                      </span>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {pageCount > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3 text-sm">
              <Button variant="secondary" disabled={page <= 1} onClick={() => void runSearch(page - 1)}>
                Previous
              </Button>
              <span className="text-[var(--muted)]">
                Page {page} of {pageCount}
              </span>
              <Button variant="secondary" disabled={page >= pageCount} onClick={() => void runSearch(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
