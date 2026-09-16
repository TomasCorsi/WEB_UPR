import { useCallback, useEffect, useState } from "react";
import { Search, CheckCircle2, AlertTriangle } from "lucide-react";
import { db, invoke, money, whatsappUrl } from "../../lib/supabase";
import { Notice } from "../../components/UI";
import type { Order } from "../../types";
const labels: Record<string, string> = {
  pending: "Pendiente",
  paid: "Pagado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};
export default function Orders({ delivery = false }: { delivery?: boolean }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const { data, error } = await db()
      .from("orders")
      .select(
        "*,order_items(*),payment_events(payment_id,status,review_reason)",
      )
      .order("created_at", { ascending: false });
    if (error) setError("No pudimos cargar los pedidos.");
    else setOrders(data as Order[]);
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 30000);
    return () => clearInterval(interval);
  }, [load]);
  async function deliver(o: Order) {
    setBusy(o.id);
    setError("");
    const { error } = await db().rpc("mark_delivered", { p_order_id: o.id });
    if (error)
      setError(
        "No se pudo registrar la entrega. Verificá que el pedido esté pagado y sin observaciones.",
      );
    else setMessage(`${o.order_number}: entrega registrada.`);
    await load();
    setBusy("");
  }
  async function reconcile(o: Order) {
    setBusy(o.id);
    setError("");
    try {
      const result = await invoke<{ message: string }>("reconcile-order", {
        order_id: o.id,
      });
      setMessage(result.message);
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos verificar el pago.",
      );
    }
    setBusy("");
  }
  async function cancelUnstarted(o: Order) {
    setBusy(o.id);
    setError("");
    const { error } = await db().rpc("cancel_unstarted_order", {
      p_order_id: o.id,
    });
    if (error)
      setError(
        "Este pedido ya inició un pago. Verificalo con Mercado Pago antes de cancelar.",
      );
    else setMessage(`${o.order_number}: cancelado. Stock liberado.`);
    await load();
    setBusy("");
  }
  const normalized = search.toLocaleLowerCase().trim();
  const filtered = orders.filter(
    (o) =>
      (filter === "all" || o.status === filter) &&
      (!delivery || normalized.length > 1) &&
      `${o.order_number} ${o.customer_name} ${o.customer_last_name} ${o.phone}`
        .toLocaleLowerCase()
        .includes(normalized),
  );
  return (
    <>
      <div className="eyebrow">
        UPR 2026 / {delivery ? "DÍA DEL EVENTO" : "ADMINISTRACIÓN"}
      </div>
      <h1>{delivery ? "Entregá un recuerdo." : "Pedidos."}</h1>
      <p>
        {delivery
          ? "Buscá por número de pedido, nombre o WhatsApp."
          : "Buscá compradores y consultá el estado de cada compra."}
      </p>
      <div className={`search-field ${delivery ? "large" : ""}`}>
        <Search />
        <input
          autoFocus={delivery}
          aria-label="Buscar pedido"
          placeholder="Buscar pedido"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {!delivery && (
        <div className="choices filter-buttons">
          {[
            ["all", "Todos"],
            ["pending", "Pendientes"],
            ["paid", "Pagados"],
            ["delivered", "Entregados"],
            ["cancelled", "Cancelados"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={filter === id ? "selected" : ""}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      {loading ? (
        <div className="skeleton" />
      ) : filtered.length ? (
        <div className="order-list">
          {filtered.map((o) => {
            const canDeliver =
              o.status === "paid" &&
              o.payment_status === "approved" &&
              !o.review_required;
            return (
              <article
                className={`order-card ${o.status === "delivered" ? "delivered" : ""}`}
                key={o.id}
              >
                <div className="row between">
                  <span className={`status ${o.status}`}>
                    {o.status === "delivered" ? (
                      <>
                        <CheckCircle2 size={18} /> PEDIDO ENTREGADO
                      </>
                    ) : canDeliver ? (
                      <>
                        <CheckCircle2 size={18} /> PAGO CONFIRMADO
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={18} />{" "}
                        {o.review_required
                          ? "REQUIERE REVISIÓN"
                          : "PAGO NO CONFIRMADO"}
                      </>
                    )}
                  </span>
                  <small>
                    {new Date(o.created_at).toLocaleDateString("es-AR")}
                  </small>
                </div>
                <h2>{o.order_number}</h2>
                <h3>
                  {o.customer_name} {o.customer_last_name}
                </h3>
                <a
                  href={whatsappUrl(
                    o.phone,
                    `Hola ${o.customer_name}, te contactamos por tu pedido ${o.order_number} de UPR 2026.`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  {o.phone} ↗
                </a>
                {!delivery && <p className="muted">{o.email}</p>}
                <div className="order-products">
                  {o.order_items.map((i) => (
                    <div key={i.id}>
                      <strong>
                        {i.quantity} × {i.product_name}
                      </strong>
                      <span>
                        {i.color} · Talle {i.size}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="row between">
                  <span>
                    {labels[o.status]} · {o.payment_status}
                  </span>
                  <strong>{money(o.total)}</strong>
                </div>
                {canDeliver && (
                  <button
                    className="button primary full"
                    disabled={busy === o.id}
                    onClick={() => void deliver(o)}
                  >
                    {busy === o.id ? "REGISTRANDO…" : "MARCAR COMO ENTREGADO ✓"}
                  </button>
                )}
                {o.status === "delivered" && (
                  <p className="delivered-note">
                    Entregado el{" "}
                    {new Date(o.delivered_at || "").toLocaleString("es-AR")}
                  </p>
                )}
                {!delivery && (
                  <button
                    className="button outline full"
                    disabled={busy === o.id}
                    onClick={() => void reconcile(o)}
                  >
                    {busy === o.id
                      ? "VERIFICANDO…"
                      : "VERIFICAR CON MERCADO PAGO"}
                  </button>
                )}
                {!delivery &&
                  o.preference_state === "new" &&
                  o.status === "pending" && (
                    <button
                      className="button outline full"
                      disabled={busy === o.id}
                      onClick={() => void cancelUnstarted(o)}
                    >
                      CANCELAR PEDIDO SIN PAGO INICIADO
                    </button>
                  )}
                {!delivery &&
                  o.payment_events?.some((p) => p.review_reason) && (
                    <Notice error>
                      Revisá estos pagos en Mercado Pago antes de entregar:
                      {o.payment_events
                        .filter((p) => p.review_reason)
                        .map((p) => (
                          <p key={p.payment_id}>
                            Pago {p.payment_id}: {p.status} ·{" "}
                            {p.review_reason ===
                            "DUPLICATE_APPROVED_PAYMENT_REFUND_REQUIRED"
                              ? "Posible pago duplicado. Revisar devolución."
                              : p.review_reason ===
                                  "AMOUNT_OR_CURRENCY_MISMATCH"
                                ? "El importe o la moneda no coinciden."
                                : p.review_reason ===
                                    "STOCK_CONFLICT_REFUND_REQUIRED"
                                  ? "Sin stock para asignar. Revisar devolución."
                                  : "Reembolso o contracargo. Revisar stock."}
                          </p>
                        ))}
                    </Notice>
                  )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          <Search size={34} />
          <h2>
            {delivery && normalized.length < 2
              ? "Listos para encontrarnos."
              : "No encontramos pedidos."}
          </h2>
          <p>
            {delivery && normalized.length < 2
              ? "Ingresá al menos dos caracteres para buscar."
              : "Probá con otro nombre o número de pedido."}
          </p>
        </div>
      )}
    </>
  );
}
