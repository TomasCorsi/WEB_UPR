import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus, ArrowLeft, Shirt } from "lucide-react";
import { db, money } from "../../lib/supabase";
import { useStore } from "../../lib/store";
import ProductVariants from "./ProductVariants";
import ProductImages from "./ProductImages";
import { Notice } from "../../components/UI";
import type { Product } from "../../types";
type Draft = Pick<
  Product,
  "name" | "slug" | "description" | "price" | "active" | "featured"
>;
const initial: Draft = {
  name: "",
  slug: "",
  description: "",
  price: 25000,
  active: false,
  featured: false,
};
export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(initial);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const { refresh } = useStore();
  const product = products.find((p) => p.id === selected);
  const load = useCallback(async () => {
    const { data, error } = await db()
      .from("products")
      .select("*,product_variants(*),product_images(*)")
      .order("created_at");
    if (error) setError("No pudimos cargar los productos.");
    else setProducts(data as Product[]);
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  function edit(p?: Product) {
    setSelected(p?.id || "new");
    setDraft(
      p
        ? {
            name: p.name,
            slug: p.slug,
            description: p.description,
            price: p.price,
            active: p.active,
            featured: p.featured,
          }
        : initial,
    );
    setMessage("");
    setError("");
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const result =
      selected === "new"
        ? await db().from("products").insert(draft).select("id").single()
        : await db()
            .from("products")
            .update(draft)
            .eq("id", selected!)
            .select("id")
            .single();
    if (result.error)
      setError(
        "No pudimos guardar. El identificador debe ser único y usar letras minúsculas, números y guiones.",
      );
    else {
      setSelected(result.data.id);
      setMessage("Producto guardado.");
      await load();
      await refresh();
    }
    setBusy(false);
  }
  return (
    <>
      <div className="row between">
        <div>
          <div className="eyebrow">LA COLECCIÓN</div>
          <h1>{selected ? "Editar producto." : "Productos."}</h1>
        </div>
        {!selected && (
          <button className="button primary" onClick={() => edit()}>
            <Plus size={18} /> NUEVO PRODUCTO
          </button>
        )}
      </div>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      {selected ? (
        <>
          <button
            className="back text-button"
            onClick={() => setSelected(null)}
          >
            <ArrowLeft size={16} /> Volver a productos
          </button>
          <form className="panel" onSubmit={save}>
            <h2>Información del producto</h2>
            <div className="form-grid">
              <label>
                Nombre
                <input
                  required
                  maxLength={160}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label>
                Identificador de URL
                <input
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  placeholder="upr-diseno-01"
                  value={draft.slug}
                  onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                />
              </label>
              <label>
                Precio (ARS)
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={draft.price}
                  onChange={(e) =>
                    setDraft({ ...draft, price: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            <label>
              Descripción
              <textarea
                rows={4}
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </label>
            <div className="row">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) =>
                    setDraft({ ...draft, active: e.target.checked })
                  }
                />{" "}
                Publicado
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={draft.featured}
                  onChange={(e) =>
                    setDraft({ ...draft, featured: e.target.checked })
                  }
                />{" "}
                Destacado
              </label>
            </div>
            <button className="button primary" disabled={busy}>
              {busy ? "GUARDANDO…" : "GUARDAR PRODUCTO"}
            </button>
          </form>
          {product && (
            <>
              <ProductVariants
                key={product.id}
                product={product}
                onSaved={async () => {
                  await load();
                  await refresh();
                }}
                setError={setError}
                setMessage={setMessage}
              />
              <ProductImages
                key={"images-" + product.id}
                product={product}
                onSaved={async () => {
                  await load();
                  await refresh();
                }}
                setError={setError}
                setMessage={setMessage}
              />
            </>
          )}
        </>
      ) : loading ? (
        <div className="skeleton" />
      ) : (
        <div className="admin-products">
          {products.map((p) => (
            <button
              className="admin-product"
              key={p.id}
              onClick={() => edit(p)}
            >
              <div>
                {p.product_images[0] ? (
                  <img src={p.product_images[0].image_url} alt="" />
                ) : (
                  <Shirt size={42} />
                )}
              </div>
              <span className="pill">
                {p.active ? "PUBLICADO" : "BORRADOR"}
              </span>
              <h3>{p.name}</h3>
              <p>
                {money(p.price)} ·{" "}
                {p.product_variants.reduce((n, v) => n + v.stock, 0)} unidades
              </p>
              <strong>EDITAR PRODUCTO ↗</strong>
            </button>
          ))}
          {!products.length && (
            <div className="empty">
              <Shirt size={38} />
              <h2>La colección empieza acá.</h2>
              <p>Creá el primer producto y cargá sus variantes.</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
