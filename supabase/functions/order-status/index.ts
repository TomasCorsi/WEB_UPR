import { authorizedOrder, body, json, preflight } from "../_shared/http.ts";
Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    const b = await body(req);
    const o = await authorizedOrder(b.order_id, b.access_token);
    if (!o)
      return json(
        {
          error:
            "No encontramos el pedido. Abrí la compra desde el navegador donde la hiciste.",
        },
        404,
      );
    return json({
      id: o.id,
      order_number: o.order_number,
      status: o.status,
      payment_status: o.payment_status,
      total: o.total,
      review_required: o.review_required,
      order_items: o.order_items.map((i: Record<string, unknown>) => ({
        id: i.id,
        product_name: i.product_name,
        color: i.color,
        size: i.size,
        quantity: i.quantity,
        unit_price: i.unit_price,
        subtotal: i.subtotal,
      })),
    });
  } catch {
    return json(
      { error: "No pudimos consultar el pedido. Intentá nuevamente." },
      500,
    );
  }
});
