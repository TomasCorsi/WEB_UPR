import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Check, Clock3, AlertCircle } from "lucide-react";
import { useCart } from "../features/cart/CartContext";
import { useStore } from "../lib/store";
import { invoke, money, whatsappUrl } from "../lib/supabase";
import { Notice, Pickup } from "../components/UI";
import type { Order } from "../types";
export default function PaymentResult() {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const id = params.get("order");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { clear } = useCart();
  const cleared = useRef(false);
  const { settings } = useStore();
  const refresh = useCallback(async () => {
    const token = id ? sessionStorage.getItem(`upr-order-${id}`) : null;
    if (!id || !token) {
      setError(
        "Para consultar el estado, volvé al navegador donde hiciste la compra o contactanos con tu número de pedido.",
      );
      return;
    }
    setBusy(true);
    try {
      const result = await invoke<Order>("order-status", {
        order_id: id,
        access_token: token,
      });
      setOrder(result);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos consultar el pedido.",
      );
    } finally {
      setBusy(false);
    }
  }, [id]);
  useEffect(() => {
    void refresh();
    if (
      order &&
      ["paid", "delivered"].includes(order.status) &&
      order.payment_status === "approved"
    )
      return;
    const interval = setInterval(() => void refresh(), 8000);
    return () => clearInterval(interval);
  }, [refresh, order?.status, order?.payment_status]);
  const paid =
    order &&
    ["paid", "delivered"].includes(order.status) &&
    order.payment_status === "approved" &&
    !order.review_required;
  useEffect(() => {
    if (paid && !cleared.current) {
      cleared.current = true;
      clear();
      sessionStorage.removeItem("upr-checkout-key");
      sessionStorage.removeItem("upr-latest-order");
    }
  }, [paid, clear]);
  async function retry() {
    if (!id) return;
    setBusy(true);
    try {
      const { init_point } = await invoke<{ init_point: string }>(
        "create-mercadopago-preference",
        {
          order_id: id,
          access_token: sessionStorage.getItem(`upr-order-${id}`),
        },
      );
      window.location.assign(init_point);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos iniciar el pago.");
      setBusy(false);
    }
  }
  const failed =
    !paid &&
    (order?.payment_status === "rejected" ||
      order?.payment_status === "cancelled" ||
      pathname === "/pago-fallido");
  return (
    <div className="container page result">
      <div className={`result-icon ${paid ? "success" : ""}`}>
        {paid ? (
          <Check size={35} />
        ) : failed ? (
          <AlertCircle size={35} />
        ) : (
          <Clock3 size={35} />
        )}
      </div>
      <div className="eyebrow">UPR 2026 / TU PEDIDO</div>
      <h1>
        {paid
          ? "¡Compra confirmada!"
          : order?.review_required
            ? "Estamos revisando tu pago."
            : failed
              ? "No pudimos confirmar el pago."
              : "Tu pago está siendo procesado."}
      </h1>
      <p>
        {paid
          ? "Nos vemos en el evento. Tu remera ya te espera."
          : "La compra se confirma cuando recibimos la aprobación de Mercado Pago."}
      </p>
      {error && <Notice error>{error}</Notice>}
      {order && (
        <div className="panel result-order">
          <span className="eyebrow">NÚMERO DE PEDIDO</span>
          <h2>{order.order_number}</h2>
          {order.order_items.map((i) => (
            <div className="summary-line" key={i.id}>
              <div>
                <strong>{i.product_name}</strong>
                <small>
                  {i.color} · Talle {i.size} · {i.quantity} un.
                </small>
              </div>
              <span>{money(i.subtotal)}</span>
            </div>
          ))}
          <div className="row between total">
            <span>Total</span>
            <strong>{money(order.total)}</strong>
          </div>
        </div>
      )}
      <Pickup compact />
      <p>
        <strong>Guardá tu número de pedido.</strong>
        <br />
        Lo vas a necesitar para retirar tu remera.
      </p>
      <div className="result-actions">
        {!paid && (
          <button
            className="button outline"
            disabled={busy}
            onClick={() => void refresh()}
          >
            {busy ? "CONSULTANDO…" : "ACTUALIZAR ESTADO"}
          </button>
        )}
        {!paid && order?.status === "pending" && !order.review_required && (
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void retry()}
          >
            {failed ? "INTENTAR NUEVAMENTE" : "RETOMAR EL PAGO"}
          </button>
        )}
        {settings.whatsapp && (
          <a
            className="button primary"
            href={whatsappUrl(
              settings.whatsapp,
              `Hola! Tengo una consulta por mi pedido ${order?.order_number || ""} de UPR 2026.`,
            )}
            target="_blank"
            rel="noreferrer"
          >
            CONSULTAR POR WHATSAPP ↗
          </a>
        )}
        <Link className="back" to="/">
          Volver a la tienda
        </Link>
      </div>
    </div>
  );
}
