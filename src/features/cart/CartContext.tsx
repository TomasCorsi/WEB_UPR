import { createContext, useContext, useState, type ReactNode } from "react";
import type { CartLine } from "../../types";
const KEY = "upr-cart-v1";
function read(): CartLine[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(data)
      ? data
          .filter((x): x is CartLine =>
            Boolean(
              x &&
              typeof x.variant_id === "string" &&
              Number.isInteger(x.quantity) &&
              x.quantity > 0 &&
              x.quantity <= 20,
            ),
          )
          .slice(0, 20)
      : [];
  } catch {
    return [];
  }
}
const Context = createContext<{
  lines: CartLine[];
  setQuantity: (id: string, qty: number) => void;
  add: (id: string, qty: number, max: number) => void;
  clear: () => void;
} | null>(null);
export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState(read);
  function update(fn: (prev: CartLine[]) => CartLine[]) {
    setLines((prev) => {
      const next = fn(prev);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* cart remains usable in memory */
      }
      return next;
    });
  }
  function setQuantity(id: string, quantity: number) {
    update((prev) =>
      quantity <= 0
        ? prev.filter((x) => x.variant_id !== id)
        : prev.map((x) =>
            x.variant_id === id
              ? { ...x, quantity: Math.min(20, Math.floor(quantity)) }
              : x,
          ),
    );
  }
  function add(id: string, qty: number, max: number) {
    update((prev) => {
      const found = prev.find((x) => x.variant_id === id);
      const quantity = Math.min(max, 20, (found?.quantity || 0) + qty);
      return quantity < 1
        ? prev
        : found
          ? prev.map((x) => (x.variant_id === id ? { ...x, quantity } : x))
          : [...prev, { variant_id: id, quantity }];
    });
  }
  return (
    <Context.Provider
      value={{ lines, setQuantity, add, clear: () => update(() => []) }}
    >
      {children}
    </Context.Provider>
  );
}
export function useCart() {
  const value = useContext(Context);
  if (!value) throw new Error("CartProvider missing");
  return value;
}
