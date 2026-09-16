import { useState, type FormEvent } from "react";
import { db } from "../../lib/supabase";
import type { Product } from "../../types";
import VariantEditor from "./VariantEditor";
export default function ProductVariants({
  product,
  onSaved,
  setError,
  setMessage,
}: {
  product: Product;
  onSaved: () => Promise<void>;
  setError: (s: string) => void;
  setMessage: (s: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [stocks, setStocks] = useState<Record<string, string>>({});
  async function addVariant(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!product) return;
    setBusy(true);
    setError("");
    const form = e.currentTarget;
    const f = new FormData(form);
    const { error } = await db()
      .from("product_variants")
      .insert({
        product_id: product.id,
        color: String(f.get("color")).trim(),
        color_hex: f.get("color_hex"),
        size: String(f.get("size")).trim().toUpperCase(),
        sku: String(f.get("sku")).trim(),
        stock: Number(f.get("stock")),
      });
    if (error)
      setError(
        "No pudimos crear la variante. Verificá que el color, talle y SKU no estén repetidos.",
      );
    else {
      form.reset();
      setMessage("Variante creada.");
      await onSaved();
    }
    setBusy(false);
  }
  async function saveStocks() {
    if (!product) return;
    setBusy(true);
    setError("");
    let failed = false;
    for (const v of product.product_variants) {
      if (stocks[v.id] === undefined) continue;
      const n = Number(stocks[v.id]);
      if (!Number.isInteger(n) || n < v.reserved) {
        failed = true;
        continue;
      }
      const { error } = await db()
        .from("product_variants")
        .update({ stock: n })
        .eq("id", v.id);
      if (error) failed = true;
    }
    if (failed)
      setError(
        "Algunos stocks no pudieron guardarse. No pueden ser negativos ni menores que las unidades reservadas.",
      );
    else {
      setMessage("Stock actualizado.");
      setStocks({});
    }
    await onSaved();
    setBusy(false);
  }
  const colors = [
    ...new Set(product?.product_variants.map((v) => v.color) || []),
  ];
  const sizes = [
    ...new Set(product?.product_variants.map((v) => v.size) || []),
  ].sort((a, b) => {
    const order = ["XS", "S", "M", "L", "XL", "XXL"];
    return (
      (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) -
      (order.indexOf(b) < 0 ? 99 : order.indexOf(b))
    );
  });
  return (
    <section className="panel">
      <div className="row between">
        <h2>Variantes y stock</h2>
        <span>
          Stock total:{" "}
          <strong>
            {product.product_variants.reduce((n, v) => n + v.stock, 0)}
          </strong>
        </span>
      </div>
      <p>Stock físico por variante. Entre paréntesis: unidades reservadas.</p>
      {colors.length > 0 && (
        <div className="table-scroll">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Color</th>
                {sizes.map((size) => (
                  <th key={size}>{size}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {colors.map((color) => (
                <tr key={color}>
                  <th>{color}</th>
                  {sizes.map((size) => {
                    const v = product.product_variants.find(
                      (v) => v.color === color && v.size === size,
                    );
                    return (
                      <td key={size}>
                        {v ? (
                          <>
                            <input
                              aria-label={`${color} ${size} stock`}
                              type="number"
                              min={v.reserved}
                              value={stocks[v.id] ?? v.stock}
                              onChange={(e) =>
                                setStocks({
                                  ...stocks,
                                  [v.id]: e.target.value,
                                })
                              }
                            />
                            <small>({v.reserved} reservadas)</small>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {colors.length > 0 && (
        <button
          className="button outline"
          onClick={() => void saveStocks()}
          disabled={busy || !Object.keys(stocks).length}
        >
          GUARDAR STOCK
        </button>
      )}
      <details>
        <summary>Editar colores, talles y SKU</summary>
        {product.product_variants.map((v) => (
          <VariantEditor
            key={v.id + v.color + v.size + v.sku}
            variant={v}
            onError={setError}
            onSaved={async () => {
              await onSaved();
            }}
          />
        ))}
      </details>
      <form className="variant-form" onSubmit={addVariant}>
        <h3>Agregar variante</h3>
        <div className="form-grid">
          <label>
            Color
            <input name="color" required maxLength={60} placeholder="Negro" />
          </label>
          <label>
            Color de muestra
            <input type="color" name="color_hex" defaultValue="#222222" />
          </label>
          <label>
            Talle
            <input
              name="size"
              required
              maxLength={20}
              list="sizes"
              placeholder="M"
            />
            <datalist id="sizes">
              {["S", "M", "L", "XL", "XXL"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </datalist>
          </label>
          <label>
            SKU
            <input name="sku" required placeholder="UPR-01-NEG-M" />
          </label>
          <label>
            Stock inicial
            <input
              name="stock"
              type="number"
              min="0"
              defaultValue="0"
              required
            />
          </label>
        </div>
        <button className="button outline" disabled={busy}>
          + AGREGAR VARIANTE
        </button>
      </form>
    </section>
  );
}
