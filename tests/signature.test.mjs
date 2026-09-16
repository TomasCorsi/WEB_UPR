import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifySignature } from "../supabase/functions/_shared/signature.ts";
test("Mercado Pago signature binds the payment id, request id, timestamp and secret", async () => {
  const secret = "test-secret-only";
  const id = "123456789";
  const request = "request-test";
  const ts = "1704908010";
  const sig = createHmac("sha256", secret)
    .update(`id:${id};request-id:${request};ts:${ts};`)
    .digest("hex");
  const header = `ts=${ts},v1=${sig}`;
  assert.equal(await verifySignature(secret, header, request, id), true);
  assert.equal(await verifySignature("wrong", header, request, id), false);
  assert.equal(
    await verifySignature(secret, header, request, "987654321"),
    false,
  );
  assert.equal(await verifySignature(secret, header, "changed", id), false);
  assert.equal(await verifySignature(secret, "", request, id), false);
  assert.equal(
    await verifySignature(secret, "ts=1,v1=garbage", request, id),
    false,
  );
  assert.equal(await verifySignature(secret, header, null, id), false);
});
