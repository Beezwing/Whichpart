"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";
import { useCart, type CartItem } from "../../lib/cart";
import { Alert, Button, Card } from "../../components/ui";

interface LiveProduct {
  id: string;
  price: string;
  inventory: { quantity: number }[];
}

export default function CartPage() {
  const { items, updateQuantity, removeItem, clear } = useCart();
  const [live, setLive] = useState<Record<string, LiveProduct>>({});

  // Price and stock shown here always come from a fresh server read, never
  // the value cached when the item was added (Rule 13/14) — the cart is a
  // shopping list, not a price quote.
  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      items.map((item) =>
        api
          .get<LiveProduct>(`/marketplace/products/${item.productId}`)
          .then((p) => [item.productId, p] as const)
          .catch(() => null),
      ),
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, LiveProduct> = {};
      for (const r of results) if (r) map[r[0]] = r[1];
      setLive(map);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i.productId).join(",")]);

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-2xl flex-1 px-6 py-12 text-center">
        <h1 className="mb-4 text-2xl font-semibold">Your cart is empty</h1>
        <Link href="/search">
          <Button>Search for parts</Button>
        </Link>
      </main>
    );
  }

  function livePriceOf(item: CartItem): number {
    return live[item.productId] ? Number(live[item.productId].price) : item.price;
  }

  const groups = new Map<string, CartItem[]>();
  for (const item of items) groups.set(item.supplierId, [...(groups.get(item.supplierId) ?? []), item]);

  const supplierGroups = [...groups.entries()].map(([supplierId, supplierItems]) => ({
    supplierId,
    supplierName: supplierItems[0].supplierName,
    items: supplierItems,
    total: supplierItems.reduce((sum, item) => sum + livePriceOf(item) * item.quantity, 0),
  }));
  const grandTotal = supplierGroups.reduce((sum, g) => sum + g.total, 0);

  return (
    <main className="mx-auto max-w-3xl flex-1 px-6 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Cart</h1>

      <div className="flex flex-col gap-6">
        {supplierGroups.map((group) => (
          <Card key={group.supplierId}>
            <Link href={`/suppliers/${group.supplierId}`} className="mb-3 block font-medium hover:underline">
              {group.supplierName}
            </Link>
            <div className="flex flex-col gap-3">
              {group.items.map((item) => {
                const livePrice = livePriceOf(item);
                const liveStock = live[item.productId]?.inventory.reduce((s, i) => s + i.quantity, 0);
                const priceChanged = live[item.productId] && livePrice !== item.price;
                const lineTotal = livePrice * item.quantity;

                return (
                  <div
                    key={item.productId}
                    className="border-t border-[var(--border)] pt-3 first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Link href={`/product/${item.productId}`} className="text-sm font-medium hover:underline">
                          {item.name}
                        </Link>
                        <p className="text-xs text-[var(--muted)]">SKU {item.sku}</p>
                        {priceChanged && (
                          <p className="text-xs text-amber-700">
                            Price updated to ${livePrice.toLocaleString()} (was ${item.price.toLocaleString()})
                          </p>
                        )}
                        {liveStock !== undefined && liveStock < item.quantity && (
                          <p className="text-xs text-red-600">Only {liveStock} left — please reduce quantity.</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.productId, Number(e.target.value))}
                          className="w-16 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm"
                        />
                        <p className="w-24 text-right text-sm font-medium">${lineTotal.toLocaleString()}</p>
                        <button
                          onClick={() => removeItem(item.productId)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 border-t border-[var(--border)] pt-3 text-right text-sm font-semibold">
              Supplier total: ${group.total.toLocaleString()}
            </p>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold">Grand total: ${grandTotal.toLocaleString()}</p>
          <button onClick={clear} className="text-xs text-[var(--muted)] hover:underline">
            Clear cart
          </button>
        </div>
      </Card>

      <div className="mt-4">
        <Alert variant="info">
          Checkout isn&apos;t built yet — you&apos;ll pay each supplier separately once it is (multiple suppliers in
          one cart means multiple payments, never one combined charge).
        </Alert>
      </div>
    </main>
  );
}
