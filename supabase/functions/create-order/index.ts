import {
  body,
  json,
  preflight,
  publicError,
  service,
  uuid,
} from "../_shared/http.ts";
Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    const b = await body(req);
    if (
      !uuid(b.request_key) ||
      !Array.isArray(b.items) ||
      b.items.length < 1 ||
      b.items.length > 20
    )
      throw new Error("INVALID_INPUT");
    for (const item of b.items)
      if (
        !item ||
        !uuid(item.variant_id) ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 20
      )
        throw new Error("INVALID_INPUT");
    for (const key of ["customer_name", "customer_last_name", "phone", "email"])
      if (typeof b[key] !== "string" || !(b[key] as string).trim())
        throw new Error("INVALID_INPUT");
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email as string) ||
      !/^[+\d ()-]{8,30}$/.test(b.phone as string)
    )
      throw new Error("INVALID_INPUT");
    const digest = async (text: string) =>
      Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
        ),
      )
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    for (const [bucket, limit] of [
      ["ip:" + (await digest(ip)), 40],
      ["email:" + (await digest((b.email as string).trim().toLowerCase())), 8],
    ] as const) {
      const { data: allowed, error: limitError } = await service().rpc(
        "checkout_rate_limit",
        { p_bucket: bucket, p_limit: limit },
      );
      if (limitError) throw limitError;
      if (!allowed)
        return json(
          {
            error:
              "Hiciste varios intentos seguidos. Esperá unos minutos antes de volver a intentar.",
          },
          429,
        );
    }
    const accessToken = crypto.randomUUID() + crypto.randomUUID();
    const { data, error } = await service().rpc("create_order", {
      p_items: b.items,
      p_customer: {
        customer_name: b.customer_name,
        customer_last_name: b.customer_last_name,
        phone: b.phone,
        email: b.email,
      },
      p_request_key: b.request_key,
      p_access_token: accessToken,
    });
    if (error) throw error;
    return json(data);
  } catch (error) {
    return json({ error: publicError(error) }, 400);
  }
});
