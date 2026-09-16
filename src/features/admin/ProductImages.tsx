import { useState, type FormEvent } from "react";
import { db } from "../../lib/supabase";
import type { Product } from "../../types";
import { Trash2 } from "lucide-react";
export default function ProductImages({
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
  const colors = [...new Set(product.product_variants.map((v) => v.color))];
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!product) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    const file = f.get("image");
    if (!(file instanceof File) || !file.size) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError("Elegí una imagen JPG, PNG o WebP de hasta 5 MB.");
      return;
    }
    setBusy(true);
    setError("");
    const ext = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    }[file.type];
    const path = `${product.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await db()
      .storage.from("products")
      .upload(path, file, { contentType: file.type });
    if (error) setError("No pudimos subir la imagen.");
    else {
      const { data } = db().storage.from("products").getPublicUrl(path);
      const { error: saveError } = await db()
        .from("product_images")
        .insert({
          product_id: product.id,
          image_url: data.publicUrl,
          color: f.get("color") || null,
          position: product.product_images.length,
        });
      if (saveError) {
        await db().storage.from("products").remove([path]);
        setError("No pudimos asociar la foto al producto.");
      } else {
        form.reset();
        setMessage("Foto subida.");
        await onSaved();
      }
    }
    setBusy(false);
  }
  async function removeImage(id: string, url: string) {
    setBusy(true);
    const { error } = await db().from("product_images").delete().eq("id", id);
    if (error) setError("No pudimos eliminar la foto.");
    else {
      const marker = "/storage/v1/object/public/products/";
      const path = url.split(marker)[1];
      if (path)
        await db()
          .storage.from("products")
          .remove([decodeURIComponent(path)]);
      await onSaved();
    }
    setBusy(false);
  }
  return (
    <section className="panel">
      <h2>Fotos del producto</h2>
      <div className="image-admin-grid">
        {[...product.product_images]
          .sort((a, b) => a.position - b.position)
          .map((img) => (
            <div key={img.id}>
              <img src={img.image_url} alt={product.name} />
              <small>{img.color || "Todos los colores"}</small>
              <button
                aria-label="Eliminar foto"
                className="icon-button"
                disabled={busy}
                onClick={() => void removeImage(img.id, img.image_url)}
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
      </div>
      <form onSubmit={upload}>
        <div className="form-grid">
          <label>
            Imagen (JPG, PNG o WebP · hasta 5 MB)
            <input
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
            />
          </label>
          <label>
            Asociar al color
            <select name="color">
              <option value="">Todos los colores</option>
              {colors.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <button className="button outline" disabled={busy}>
          SUBIR FOTO
        </button>
      </form>
    </section>
  );
}
