import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db, money } from "../../lib/supabase";
import { useStore } from "../../lib/store";
import { Notice } from "../../components/UI";
import type { Order, Variant } from "../../types";
export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const { settings, refresh, products } = useStore();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void Promise.all([
      db()
        .from("orders")
        .select("*,order_items(*)")
        .order("created_at", { ascending: false }),
      db().from("product_variants").select("*"),
    ]).then(([o, v]) => {
      if (o.error || v.error) setError("No pudimos cargar el resumen.");
      else {
        setOrders(o.data as Order[]);
        setVariants(v.data as Variant[]);
      }
      setLoading(false);
    });
  }, []);
  async function toggle() {
    setBusy(true);
    const { error } = await db()
      .from("store_settings")
      .update({ sales_enabled: !settings.sales_enabled })
      .eq("id", true);
    if (error) setError("No pudimos cambiar el estado de las ventas.");
    else await refresh();
    setBusy(false);
  }
  const paid = orders.filter(
    (o) =>
      ["paid", "delivered"].includes(o.status) &&
      o.payment_status === "approved",
  );
  const sold = orders
    .filter((o) => o.stock_applied)
    .reduce((n, o) => n + o.order_items.reduce((s, i) => s + i.quantity, 0), 0);
  const remaining = variants.reduce((n, v) => n + v.stock, 0);
  const reserved = variants.reduce((n, v) => n + v.reserved, 0);
  return (
    <>
      <div className="eyebrow">UPR 2026 / VISTA GENERAL</div>
      <h1>Todo bajo control.</h1>
      {error && <Notice error>{error}</Notice>}
      <div className="sales-control">
        <div>
          <strong>VENTAS UPR 2026</strong>
          <p>
            {settings.sales_enabled
              ? "La tienda está recibiendo pedidos."
              : "Las ventas online están pausadas."}
          </p>
        </div>
        <button
          className={`toggle ${settings.sales_enabled ? "on" : ""}`}
          role="switch"
          aria-checked={settings.sales_enabled}
          disabled={busy}
          onClick={() => void toggle()}
        >
          {settings.sales_enabled ? "ON" : "OFF"}
          <span />
        </button>
      </div>
      {loading ? (
        <div className="skeleton" />
      ) : (
        <>
          <div className="stats">
            {[
              ["Stock total", remaining + sold],
              ["Vendidas", sold],
              [
                "Disponibles",
                variants
                  .filter(
                    (v) =>
                      v.active && products.some((p) => p.id === v.product_id),
                  )
                  .reduce((n, v) => n + v.stock - v.reserved, 0),
              ],
              ["Facturación", money(paid.reduce((n, o) => n + o.total, 0))],
              ["Pedidos pagados", paid.length],
            ].map(([label, value]) => (
              <div className="stat" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <Notice>
            {reserved} unidades reservadas en pedidos pendientes. Las reservas
            no se liberan automáticamente mientras pueda haber un pago en
            proceso.
          </Notice>
          {orders.some((o) => o.review_required) && (
            <Notice error>
              Hay pedidos que requieren revisión de pagos.{" "}
              <Link to="/admin/pedidos">Ver pedidos</Link>
            </Notice>
          )}
          <div className="section-title">
            <h2>Últimos pedidos</h2>
            <Link to="/admin/pedidos">Ver todos →</Link>
          </div>
          {orders.slice(0, 5).map((o) => (
            <Link to="/admin/pedidos" className="recent-order" key={o.id}>
              <strong>{o.order_number}</strong>
              <span>
                {o.customer_name} {o.customer_last_name}
              </span>
              <span>
                {o.status === "delivered"
                  ? "Entregado"
                  : o.status === "paid"
                    ? "Pagado"
                    : "Pendiente"}
              </span>
              <strong>{money(o.total)}</strong>
            </Link>
          ))}
          {!orders.length && (
            <p className="muted">
              Todavía no hay pedidos. Cargá tus productos para comenzar.
            </p>
          )}
          <Link to="/admin/entregas" className="event-admin">
            <span>
              <strong>¿Ya estamos en el evento?</strong>
              <small>Buscá un pedido y registrá la entrega.</small>
            </span>
            <span>ABRIR ENTREGAS ↗</span>
          </Link>
        </>
      )}
    </>
  );
}
