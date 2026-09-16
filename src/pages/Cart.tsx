import { Link } from "react-router-dom";
import { Trash2, Shirt } from "lucide-react";
import { useStore } from "../lib/store";
import { useCart } from "../features/cart/CartContext";
import { money } from "../lib/supabase";
import { Empty, Notice, Pickup } from "../components/UI";
export function useResolvedCart() {
  const { products } = useStore();
  const { lines } = useCart();
  return lines.map((line) => {
    const product = products.find((p) =>
      p.product_variants.some((v) => v.id === line.variant_id),
    );
    const variant = product?.product_variants.find(
      (v) => v.id === line.variant_id,
    );
    return {
      ...line,
      product,
      variant,
      available: variant?.active
        ? Math.max(0, variant.stock - variant.reserved)
        : 0,
    };
  });
}
export default function Cart() {
  const cart = useResolvedCart();
  const { setQuantity } = useCart();
  const { settings, loading, error } = useStore();
  const total = cart.reduce(
    (n, l) => n + (l.product?.price || 0) * l.quantity,
    0,
  );
  const valid =
    cart.length > 0 &&
    cart.every((l) => l.product && l.variant && l.available >= l.quantity);
  return (
    <div className="container page">
      <div className="eyebrow">UN PASO MÁS CERCA</div>
      <h1 className="page-title">Tu carrito.</h1>
      {loading ? (
        <div className="skeleton" />
      ) : error ? (
        <Notice error>{error}</Notice>
      ) : !cart.length ? (
        <Empty title="Tu próxima remera te espera.">
          <p>Todavía no agregaste productos al carrito.</p>
          <Link className="button primary" to="/#remeras">
            EXPLORAR REMERAS →
          </Link>
        </Empty>
      ) : (
        <div className="checkout-grid">
          <div className="cart-items">
            {cart.map((l) => (
              <article className="cart-item" key={l.variant_id}>
                <div className="cart-image">
                  {l.product?.product_images[0] ? (
                    <img
                      src={l.product.product_images[0].image_url}
                      alt={l.product.name}
                    />
                  ) : (
                    <Shirt />
                  )}
                </div>
                <div>
                  <h3>{l.product?.name || "Producto no disponible"}</h3>
                  <p>
                    {l.variant?.color} / Talle {l.variant?.size}
                  </p>
                  <strong>{money(l.product?.price || 0)}</strong>
                  {l.available < l.quantity && (
                    <p className="error-text">
                      {l.available
                        ? `Quedan ${l.available}. Ajustá la cantidad.`
                        : "Esta variante ya no está disponible."}
                    </p>
                  )}
                  <label className="qty-label">
                    Cantidad{" "}
                    <input
                      aria-label={`Cantidad de ${l.product?.name || "producto"}`}
                      type="number"
                      min="1"
                      max="20"
                      value={l.quantity}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isInteger(n) && n > 0)
                          setQuantity(l.variant_id, n);
                      }}
                    />
                  </label>
                </div>
                <div className="cart-end">
                  <button
                    className="icon-button"
                    aria-label="Eliminar producto"
                    onClick={() => setQuantity(l.variant_id, 0)}
                  >
                    <Trash2 size={19} />
                  </button>
                  <strong>{money((l.product?.price || 0) * l.quantity)}</strong>
                </div>
              </article>
            ))}
            <Link className="back" to="/#remeras">
              ← Seguir viendo remeras
            </Link>
          </div>
          <aside className="summary">
            <h2>Resumen de compra</h2>
            <div className="row between">
              <span>Subtotal</span>
              <span>{money(total)}</span>
            </div>
            <div className="row between">
              <span>Retiro en UPR 2026</span>
              <strong>GRATIS</strong>
            </div>
            <div className="row between total">
              <span>Total</span>
              <strong>{money(total)}</strong>
            </div>
            {valid && settings.sales_enabled ? (
              <Link className="button primary full" to="/checkout">
                CONTINUAR COMPRA →
              </Link>
            ) : (
              <Notice>
                {!settings.sales_enabled
                  ? "Las ventas online están momentáneamente pausadas."
                  : "Revisá la disponibilidad de tu carrito."}
              </Notice>
            )}
            <Pickup compact />
          </aside>
        </div>
      )}
    </div>
  );
}
