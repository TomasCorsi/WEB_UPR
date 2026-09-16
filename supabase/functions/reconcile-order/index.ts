import {
  applyPayment,
  body,
  env,
  json,
  mp,
  preflight,
  service,
  uuid,
} from "../_shared/http.ts";
Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    const db = service();
    const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token) return json({ error: "Iniciá sesión." }, 401);
    const {
      data: { user },
      error,
    } = await db.auth.getUser(token);
    if (error || !user) return json({ error: "Sesión inválida." }, 401);
    const { data: admin } = await db
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!admin) return json({ error: "Acceso denegado." }, 403);
    const b = await body(req);
    if (!uuid(b.order_id)) return json({ error: "Pedido inválido." }, 400);
    const { data: order, error: orderError } = await db
      .from("orders")
      .select("*")
      .eq("id", b.order_id)
      .single();
    if (orderError || !order)
      return json({ error: "No encontramos el pedido." }, 404);
    // Recover a preference created remotely if the original response/save was lost.
    if (
      ["creating", "uncertain"].includes(order.preference_state) &&
      !order.mercadopago_preference_id
    ) {
      const search = await mp(
        `/checkout/preferences/search?external_reference=${b.order_id}`,
      );
      const found = (search.elements || []).filter(
        (p: Record<string, unknown>) => p.external_reference === b.order_id,
      );
      if (found.length === 1) {
        const preference = await mp(
          `/checkout/preferences/${encodeURIComponent(found[0].id)}`,
        );
        const point =
          env("MERCADOPAGO_LIVE_MODE") === "true"
            ? preference.init_point
            : preference.sandbox_init_point;
        if (
          preference.external_reference === b.order_id &&
          String(preference.collector_id) === env("MERCADOPAGO_COLLECTOR_ID") &&
          typeof point === "string"
        ) {
          const { error: saveError } = await db.rpc("recover_preference", {
            p_order_id: order.id,
            p_preference_id: preference.id,
            p_init_point: point,
          });
          if (saveError) throw saveError;
        }
      }
    }
    const result = await mp(
      `/v1/payments/search?external_reference=${b.order_id}&sort=date_created&criteria=asc&limit=100`,
    );
    for (const payment of result.results || []) await applyPayment(payment);
    return json({
      message: `Verificados ${result.results?.length || 0} pagos. Las reservas pendientes se conservan hasta resolver el pago.`,
    });
  } catch {
    return json(
      { error: "No pudimos verificar los pagos. Intentá nuevamente." },
      502,
    );
  }
});
