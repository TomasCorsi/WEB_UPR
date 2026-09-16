import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Minus,
  Ruler,
  ShoppingBag,
  Shirt,
  Check,
} from "lucide-react";
import { useStore } from "../lib/store";
import { useCart } from "../features/cart/CartContext";
import { money } from "../lib/supabase";
import { Empty, Notice, Pickup, SizeGuide } from "../components/UI";
export default function ProductPage() {
  const { slug } = useParams();
  const { products, settings, loading, error } = useStore();
  const { add } = useCart();
  const p = products.find((p) => p.slug === slug);
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [qty, setQty] = useState(1);
  const [guide, setGuide] = useState(false);
  const [added, setAdded] = useState(false);
  const [photo, setPhoto] = useState(0);
  if (loading)
    return (
      <div className="container page">
        <div className="skeleton" />
      </div>
    );
  if (error)
    return (
      <div className="container page">
        <Notice error>{error}</Notice>
      </div>
    );
  if (!p)
    return (
      <Empty title="Esta remera no está disponible.">
        <Link to="/" className="button">
          Volver a la colección
        </Link>
      </Empty>
    );
  const variants = p.product_variants.filter((v) => v.active);
  const colors = [...new Map(variants.map((v) => [v.color, v])).values()];
  const selectedColor = color || colors[0]?.color;
  const v = variants.find((v) => v.color === selectedColor && v.size === size);
  const stock = v ? Math.max(0, v.stock - v.reserved) : 0;
  const specific = p.product_images.filter((i) => i.color === selectedColor);
  const photos = (
    specific.length ? specific : p.product_images.filter((i) => !i.color)
  ).sort((a, b) => a.position - b.position);
  return (
    <div className="container page">
      <Link to="/#remeras" className="back">
        <ArrowLeft size={16} /> Volver a las remeras
      </Link>
      <div className="product-detail">
        <div>
          <div className="detail-photo">
            {photos[photo] ? (
              <img
                src={photos[photo].image_url}
                alt={`${p.name} · ${selectedColor}`}
              />
            ) : (
              <Shirt size={160} strokeWidth={0.5} />
            )}
          </div>
          <div className="thumbnails">
            {photos.map((img, i) => (
              <button
                aria-label={`Ver foto ${i + 1}`}
                aria-pressed={i === photo}
                key={img.id}
                onClick={() => setPhoto(i)}
              >
                <img src={img.image_url} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
        <div className="product-info">
          <span className="eyebrow">UPR 2026 / REMERAS OFICIALES</span>
          <h1>{p.name}</h1>
          <div className="detail-price">{money(p.price)}</div>
          <p className="description">{p.description}</p>
          <div className="field-title">
            Color <strong>{selectedColor || "Sin variantes"}</strong>
          </div>
          <div className="choices">
            {colors.map((c) => (
              <button
                className={selectedColor === c.color ? "selected" : ""}
                key={c.color}
                onClick={() => {
                  setColor(c.color);
                  setSize("");
                  setPhoto(0);
                  setAdded(false);
                }}
              >
                <span
                  className="color-dot"
                  style={{ background: c.color_hex }}
                />
                {c.color}
              </button>
            ))}
          </div>
          <div className="row between field-title">
            <span>Talle</span>
            <button className="text-button" onClick={() => setGuide(true)}>
              <Ruler size={16} /> Guía de talles
            </button>
          </div>
          <div className="choices">
            {variants
              .filter((v) => v.color === selectedColor)
              .map((v) => (
                <button
                  key={v.id}
                  disabled={v.stock - v.reserved <= 0}
                  className={size === v.size ? "selected" : ""}
                  onClick={() => {
                    setSize(v.size);
                    setQty(1);
                    setAdded(false);
                  }}
                >
                  {v.size}
                </button>
              ))}
          </div>
          <p className="stock-label">
            {!v
              ? "Seleccioná un talle para ver disponibilidad."
              : stock === 0
                ? "AGOTADO"
                : stock <= 5
                  ? `¡Últimas unidades! Quedan ${stock}.`
                  : "Disponible para vos."}
          </p>
          <div className="row purchase">
            <div className="quantity">
              <button
                aria-label="Restar unidad"
                disabled={qty <= 1}
                onClick={() => setQty((q) => q - 1)}
              >
                <Minus size={16} />
              </button>
              <span>{qty}</span>
              <button
                aria-label="Sumar unidad"
                disabled={qty >= Math.min(stock, 20)}
                onClick={() => setQty((q) => q + 1)}
              >
                <Plus size={16} />
              </button>
            </div>
            <button
              className="button primary"
              disabled={!v || stock < qty || !settings.sales_enabled}
              onClick={() => {
                if (v) {
                  add(v.id, qty, stock);
                  setAdded(true);
                }
              }}
            >
              {added ? <Check size={19} /> : <ShoppingBag size={19} />}{" "}
              {added ? "AGREGADO" : "AGREGAR AL CARRITO"}
            </button>
          </div>
          {added && (
            <Link className="button outline full" to="/carrito">
              VER MI CARRITO →
            </Link>
          )}
          {!settings.sales_enabled && (
            <Notice>Las ventas online están momentáneamente pausadas.</Notice>
          )}
          <Pickup compact />
        </div>
      </div>
      {guide && <SizeGuide close={() => setGuide(false)} />}
    </div>
  );
}
