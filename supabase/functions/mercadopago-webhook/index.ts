import { applyPayment, env, mp } from "../_shared/http.ts";
import { verifySignature } from "../_shared/signature.ts";
async function verify(req: Request, id: string) {
  return verifySignature(
    env("MERCADOPAGO_WEBHOOK_SECRET"),
    req.headers.get("x-signature") || "",
    req.headers.get("x-request-id"),
    id,
  );
}
Deno.serve(async (req) => {
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("data.id");
    if (!id || !(await verify(req, id)))
      return new Response("Invalid signature", { status: 401 });
    const b = await req.json();
    if (b.type !== "payment") return new Response("Ignored", { status: 200 });
    if (String(b.data?.id) !== id)
      return new Response("Invalid payment", { status: 400 });
    const payment = await mp(`/v1/payments/${encodeURIComponent(id)}`);
    await applyPayment(payment);
    return new Response("OK", { status: 200 });
  } catch {
    return new Response("Retry later", { status: 500 });
  }
});
