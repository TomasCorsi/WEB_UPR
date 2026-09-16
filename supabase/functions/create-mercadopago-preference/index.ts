import {
  authorizedOrder,
  body,
  env,
  json,
  mp,
  preflight,
  publicError,
  service,
} from "../_shared/http.ts";
Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    const b = await body(req);
    const o = await authorizedOrder(b.order_id, b.access_token);
    if (!o) return json({ error: "No encontramos el pedido." }, 404);
    if (o.status !== "pending" || !o.reserved)
      return json({ error: "Este pedido ya no está pendiente de pago." }, 409);
    if (o.init_point) return json({ init_point: o.init_point });
    const { data: enabled, error: settingsError } = await service()
      .from("store_settings")
      .select("sales_enabled")
      .eq("id", true)
      .single();
    if (settingsError || !enabled?.sales_enabled)
      return json(
        { error: "Las ventas online están momentáneamente pausadas." },
        409,
      );
    const { data: claimed, error } = await service().rpc("claim_preference", {
      p_order_id: o.id,
    });
    if (error) throw error;
    if (!claimed)
      return json(
        {
          error:
            "Estamos verificando el enlace de pago de tu pedido. Contactanos con tu número de pedido antes de volver a comprar.",
        },
        409,
      );
    try {
      const site = env("SITE_URL").replace(/\/$/, "");
      const returnUrl = (route: string) => `${site}/${route}?order=${o.id}`;
      const pref = await mp("/checkout/preferences", {
        method: "POST",
        body: JSON.stringify({
          items: o.order_items.map(
            (i: {
              variant_id: string;
              product_name: string;
              color: string;
              size: string;
              quantity: number;
              unit_price: number;
            }) => ({
              id: i.variant_id,
              title: `${i.product_name} / ${i.color} / ${i.size}`,
              quantity: i.quantity,
              unit_price: Number(i.unit_price),
              currency_id: "ARS",
            }),
          ),
          payer: {
            name: o.customer_name,
            surname: o.customer_last_name,
            email: o.email,
          },
          external_reference: o.id,
          back_urls: {
            success: returnUrl("compra-exitosa"),
            pending: returnUrl("pago-pendiente"),
            failure: returnUrl("pago-fallido"),
          },
          auto_return: "approved",
          notification_url: `${env("SUPABASE_URL")}/functions/v1/mercadopago-webhook`,
          statement_descriptor: "UPR 2026",
          expires: true,
          expiration_date_to: new Date(
            Date.now() + 30 * 60 * 1000,
          ).toISOString(),
          payment_methods: {
            excluded_payment_types: [{ id: "ticket" }, { id: "atm" }],
          },
        }),
      });
      const point =
        env("MERCADOPAGO_LIVE_MODE") === "true"
          ? pref.init_point
          : pref.sandbox_init_point;
      if (typeof point !== "string") throw new Error("INVALID_PREFERENCE");
      const { error: saveError } = await service()
        .from("orders")
        .update({
          mercadopago_preference_id: pref.id,
          init_point: point,
          preference_state: "ready",
        })
        .eq("id", o.id);
      if (saveError) throw saveError;
      return json({ init_point: point });
    } catch (error) {
      if (
        error instanceof Error &&
        /^MP_HTTP_(400|401|403|404|422)$/.test(error.message)
      ) {
        await service()
          .from("orders")
          .update({ preference_state: "new" })
          .eq("id", o.id);
        return json(
          {
            error:
              "Mercado Pago no pudo habilitar el pago. Conservamos tu pedido; intentá nuevamente o contactanos.",
          },
          502,
        );
      }
      await service()
        .from("orders")
        .update({ preference_state: "uncertain", review_required: true })
        .eq("id", o.id);
      return json(
        {
          error:
            "No pudimos verificar el enlace de pago. Conservamos tu pedido; contactanos antes de intentar una compra nueva.",
        },
        502,
      );
    }
  } catch (error) {
    return json({ error: publicError(error) }, 400);
  }
});
