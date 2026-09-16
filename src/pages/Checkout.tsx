import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import { useResolvedCart } from "./Cart";
import { useStore } from "../lib/store";
import { invoke, money } from "../lib/supabase";
import { Empty, Notice, Pickup } from "../components/UI";
export interface CheckoutOrder {
  order_id: string;
  order_number: string;
  access_token: string;
}
export default function Checkout() {
  const lines = useResolvedCart();
  const { settings, loading } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [previous] = useState<CheckoutOrder | null>(() => {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem("upr-latest-order") || "null",
      );
      return saved?.order_id && saved?.access_token ? saved : null;
    } catch {
      return null;
    }
  });
  const total = lines.reduce(
    (n, l) => n + (l.product?.price || 0) * l.quantity,
    0,
  );
  const valid =
    lines.length > 0 &&
    lines.every((l) => l.product && l.available >= l.quantity);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      let current = order;
      if (!current) {
        let requestKey = sessionStorage.getItem("upr-checkout-key");
        if (!requestKey) {
          requestKey = crypto.randomUUID();
          sessionStorage.setItem("upr-checkout-key", requestKey);
        }
        current = await invoke<CheckoutOrder>("create-order", {
          items: lines.map(({ variant_id, quantity }) => ({
            variant_id,
            quantity,
          })),
          customer_name: data.get("customer_name"),
          customer_last_name: data.get("customer_last_name"),
          phone: data.get("phone"),
          email: data.get("email"),
          request_key: requestKey,
        });
        setOrder(current);
        sessionStorage.setItem(
          `upr-order-${current.order_id}`,
          current.access_token,
        );
        sessionStorage.setItem("upr-latest-order", JSON.stringify(current));
      }
      const response = await invoke<{ init_point: string }>(
        "create-mercadopago-preference",
        current,
      );
      window.location.assign(response.init_point);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No pudimos iniciar el pago. Intentá nuevamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <div className="container page">
        <div className="skeleton" />
      </div>
    );
  if (!lines.length)
    return (
      <Empty title="Tu carrito está vacío.">
        <Link to="/" className="button primary">
          VER REMERAS
        </Link>
      </Empty>
    );
  return (
    <div className="container page">
      <Link to="/carrito" className="back">
        ← Volver al carrito
      </Link>
      <div className="eyebrow">TU REMERA, CADA VEZ MÁS CERCA</div>
      <h1 className="page-title">Completá tu compra.</h1>
      {previous && (
        <Notice>
          Ya iniciaste el pedido <strong>{previous.order_number}</strong>.{" "}
          <Link to={`/pago-pendiente?order=${previous.order_id}`}>
            Consultar el estado o retomar el pago
          </Link>
          .
        </Notice>
      )}
      <form className="checkout-grid" onSubmit={submit}>
        <div>
          <div className="panel">
            <h2>01. Tus datos</h2>
            <p>Sin crear una cuenta. Los usamos para identificar tu pedido.</p>
            <div className="form-grid">
              <label>
                Nombre
                <input
                  name="customer_name"
                  autoComplete="given-name"
                  required
                  maxLength={80}
                  disabled={Boolean(order)}
                />
              </label>
              <label>
                Apellido
                <input
                  name="customer_last_name"
                  autoComplete="family-name"
                  required
                  maxLength={80}
                  disabled={Boolean(order)}
                />
              </label>
              <label>
                WhatsApp
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+54 9 …"
                  required
                  minLength={8}
                  maxLength={30}
                  disabled={Boolean(order)}
                />
              </label>
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={200}
                  disabled={Boolean(order)}
                />
              </label>
            </div>
          </div>
          <div className="panel">
            <h2>02. Retiro</h2>
            <Pickup compact />
          </div>
          <p className="muted">
            Al continuar aceptás los{" "}
            <Link to="/informacion/terminos">términos</Link> y la{" "}
            <Link to="/informacion/privacidad">política de privacidad</Link>.
          </p>
        </div>
        <aside className="summary">
          <h2>Tu pedido</h2>
          {lines.map((l) => (
            <div className="summary-line" key={l.variant_id}>
              <div>
                <strong>{l.product?.name}</strong>
                <small>
                  {l.variant?.color} · {l.variant?.size} · {l.quantity} un.
                </small>
              </div>
              <span>{money((l.product?.price || 0) * l.quantity)}</span>
            </div>
          ))}
          <div className="row between total">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>
          {error && <Notice error>{error}</Notice>}
          {!valid && !order && (
            <Notice error>
              La disponibilidad cambió.{" "}
              <Link to="/carrito">Revisá tu carrito</Link> antes de continuar.
            </Notice>
          )}
          {!settings.sales_enabled && (
            <Notice>Las ventas online están momentáneamente pausadas.</Notice>
          )}
          <button
            className="button mp full"
            disabled={busy || !settings.sales_enabled || (!valid && !order)}
          >
            {busy
              ? "PREPARANDO TU PAGO…"
              : order
                ? "REINTENTAR PAGO CON MERCADO PAGO"
                : "PAGAR CON MERCADO PAGO"}
          </button>
          <p className="secure">
            <LockKeyhole size={14} /> Tu pago se completa en Mercado Pago.
          </p>
          <p className="muted">
            No realizamos envíos. Retiro únicamente el día del evento.
          </p>
        </aside>
      </form>
    </div>
  );
}
