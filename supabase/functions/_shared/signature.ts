export async function verifySignature(
  secret: string,
  signature: string,
  requestId: string | null,
  id: string,
): Promise<boolean> {
  const parts: Record<string, string> = Object.fromEntries(
    signature.split(",").map((x) => x.trim().split("=")),
  );
  const { ts, v1 } = parts;
  if (
    !requestId ||
    !ts ||
    !v1 ||
    !/^[a-f0-9]{64}$/i.test(v1) ||
    !/^\d+$/.test(ts)
  )
    return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const bytes = Uint8Array.from(v1.match(/.{2}/g)!.map((x) => parseInt(x, 16)));
  return crypto.subtle.verify(
    "HMAC",
    key,
    bytes,
    new TextEncoder().encode(
      `id:${id.toLowerCase()};request-id:${requestId};ts:${ts};`,
    ),
  );
}
