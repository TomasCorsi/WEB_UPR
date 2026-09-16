import { createClient } from "npm:@supabase/supabase-js@2.116.0";
export function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing secret: ${name}`);
  return value;
}
export function service() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
}
export function headers() {
  return {
    "Access-Control-Allow-Origin": env("SITE_URL").replace(/\/$/, ""),
    "Access-Control-Allow-Headers":
      "authorization, apikey, x-client-info, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}
export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: headers() });
}
export function preflight(req: Request): Response | null {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: headers() });
  if (req.method !== "POST")
    return json({ error: "Método no permitido." }, 405);
  const origin = req.headers.get("origin");
  if (origin && origin !== env("SITE_URL").replace(/\/$/, ""))
    return json({ error: "Origen no permitido." }, 403);
  return null;
}
export async function body(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > 20000) throw new Error("INVALID_INPUT");
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_INPUT");
  return value as Record<string, unknown>;
}
export const uuid = (x: unknown): x is string =>
  typeof x === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    x,
  );
export async function authorizedOrder(id: unknown, token: unknown) {
  if (!uuid(id) || typeof token !== "string" || token.length < 32) return null;
  const { data, error } = await service()
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .eq("access_token", token)
    .maybeSingle();
  if (error) throw error;
  return data;
}
export async function mp(path: string, options: RequestInit = {}) {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${env("MERCADOPAGO_ACCESS_TOKEN")}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`MP_HTTP_${response.status}`);
  return response.json();
}
export const publicError = (error: unknown) => {
  const msg =
    error instanceof Error
      ? error.message
      : String((error as { message?: string })?.message || "");
  if (/INSUFFICIENT_STOCK|PRODUCT_UNAVAILABLE/.test(msg))
    return "Una variante ya no tiene stock disponible. Revisá tu carrito.";
  if (/EXISTING_ORDER/.test(msg))
    return "Ya tenés un pedido iniciado con otros datos. Consultá su estado antes de volver a comprar.";
  if (/SALES_PAUSED/.test(msg))
    return "Las ventas online están momentáneamente pausadas.";
  if (/INVALID|DUPLICATE|check constraint/.test(msg))
    return "Revisá tus datos y las cantidades del carrito.";
  return "No pudimos completar la operación. Intentá nuevamente en unos minutos.";
};
export async function applyPayment(payment: Record<string, unknown>) {
  if (!uuid(payment.external_reference)) throw new Error("INVALID_REFERENCE");
  if (String(payment.collector_id) !== env("MERCADOPAGO_COLLECTOR_ID"))
    throw new Error("INVALID_COLLECTOR");
  if (payment.live_mode !== (env("MERCADOPAGO_LIVE_MODE") === "true"))
    throw new Error("INVALID_ENVIRONMENT");
  const { error } = await service().rpc("apply_payment", {
    p_order_id: payment.external_reference,
    p_payment_id: String(payment.id),
    p_status: payment.status,
    p_amount: payment.transaction_amount,
    p_currency: payment.currency_id,
  });
  if (error) throw error;
}
