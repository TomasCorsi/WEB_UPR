import { useState, type FormEvent } from "react";
import { db } from "../../lib/supabase";
import type { Variant } from "../../types";
export default function VariantEditor({
  variant: v,
  onSaved,
  onError,
}: {
  variant: Variant;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const { error } = await db()
      .from("product_variants")
      .update({
        color: String(f.get("color")).trim(),
        color_hex: f.get("color_hex"),
        size: String(f.get("size")).trim().toUpperCase(),
        sku: String(f.get("sku")).trim(),
        active: f.get("active") === "on",
      })
      .eq("id", v.id);
    if (error)
      onError(
        "No pudimos guardar la variante. Revisá que el SKU y la combinación de color y talle sean únicos.",
      );
    else await onSaved();
    setBusy(false);
  }
  return (
    <details>
      <summary>
        {v.color} / {v.size} · {v.sku} · {v.active ? "Activa" : "Inactiva"}
      </summary>
      <form className="variant-form" onSubmit={save}>
        <div className="form-grid">
          <label>
            Color
            <input name="color" required defaultValue={v.color} />
          </label>
          <label>
            Color de muestra
            <input name="color_hex" type="color" defaultValue={v.color_hex} />
          </label>
          <label>
            Talle
            <input name="size" required defaultValue={v.size} />
          </label>
          <label>
            SKU
            <input name="sku" required defaultValue={v.sku} />
          </label>
        </div>
        <label className="checkbox">
          <input name="active" type="checkbox" defaultChecked={v.active} />{" "}
          Variante activa
        </label>
        <button className="button outline" disabled={busy}>
          GUARDAR VARIANTE
        </button>
      </form>
    </details>
  );
}
