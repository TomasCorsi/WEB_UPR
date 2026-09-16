import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
let db;
test("changed cart cannot reuse an existing checkout key", async () => {
  const { v } = await variant(3);
  const key = randomUUID();
  await order(v, 1, key);
  await assert.rejects(order(v, 2, key), /EXISTING_ORDER/);
});
test("multi-item order rolls back every reservation when any item is unavailable", async () => {
  const a = await variant(3),
    b = await variant(0);
  await assert.rejects(
    db.query("select create_order($1,$2,$3,$4)", [
      JSON.stringify([
        { variant_id: a.v, quantity: 2 },
        { variant_id: b.v, quantity: 1 },
      ]),
      JSON.stringify(customer),
      randomUUID(),
      randomUUID(),
    ]),
    /INSUFFICIENT_STOCK/,
  );
  assert.equal(
    (await db.query("select reserved from product_variants where id=$1", [a.v]))
      .rows[0].reserved,
    0,
  );
});
test("human-readable order numbers do not truncate after 9999", async () => {
  await db.exec("select setval('order_number_seq',10000,false)");
  assert.equal(
    (await db.query("select next_order_number() as n")).rows[0].n,
    "UPR-10000",
  );
});
const adminId = randomUUID();
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;
 grant usage on schema public,auth to anon,authenticated,service_role;
 create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key,bucket_id text); alter table storage.objects enable row level security;`);
  for (const file of (
    await readdir(new URL("../supabase/migrations/", import.meta.url))
  ).sort()) {
    await db.exec(
      await readFile(
        new URL(`../supabase/migrations/${file}`, import.meta.url),
        "utf8",
      ),
    );
  }
  await db.query("insert into auth.users(id) values($1)", [adminId]);
  await db.query("insert into admin_users(user_id) values($1)", [adminId]);
  await db.exec("update store_settings set sales_enabled=true");
});
after(async () => {
  await db.close();
});
test("rate limits reject excess attempts and reset after the window", async () => {
  const bucket = randomUUID();
  assert.equal(
    (await db.query("select checkout_rate_limit($1,2) as allowed", [bucket]))
      .rows[0].allowed,
    true,
  );
  assert.equal(
    (await db.query("select checkout_rate_limit($1,2) as allowed", [bucket]))
      .rows[0].allowed,
    true,
  );
  assert.equal(
    (await db.query("select checkout_rate_limit($1,2) as allowed", [bucket]))
      .rows[0].allowed,
    false,
  );
  await db.query(
    "update checkout_rate_limits set window_start=now()-interval '16 minutes' where bucket=$1",
    [bucket],
  );
  assert.equal(
    (await db.query("select checkout_rate_limit($1,2) as allowed", [bucket]))
      .rows[0].allowed,
    true,
  );
});
async function variant(stock = 3) {
  const p = randomUUID(),
    v = randomUUID();
  await db.query(
    "insert into products(id,name,slug,price,active) values($1,'Test shirt',$2,25000,true)",
    [p, `test-${p}`],
  );
  await db.query(
    "insert into product_variants(id,product_id,color,size,sku,stock) values($1::uuid,$2,'Negro','M',$1::text,$3)",
    [v, p, stock],
  );
  return { p, v };
}
const customer = {
  customer_name: "Test",
  customer_last_name: "Comprador",
  phone: "+5491100000000",
  email: "test@example.com",
};
async function order(v, quantity = 1, key = randomUUID()) {
  const { rows } = await db.query(
    "select create_order($1::jsonb,$2::jsonb,$3,$4) as result",
    [
      JSON.stringify([{ variant_id: v, quantity }]),
      JSON.stringify(customer),
      key,
      randomUUID() + randomUUID(),
    ],
  );
  return rows[0].result;
}
async function payment(
  o,
  id = randomUUID(),
  status = "approved",
  amount = 25000,
  currency = "ARS",
) {
  const { rows } = await db.query(
    "select apply_payment($1,$2,$3,$4,$5) as result",
    [o.order_id, id, status, amount, currency],
  );
  return rows[0].result;
}
async function asRole(role, fn, user = "") {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.exec("select set_config('request.jwt.claim.sub','',false)");
  }
}
test("authoritative price, reservation, retry identity, snapshot and webhook idempotency", async () => {
  const { v, p } = await variant(2);
  const key = randomUUID();
  const o = await order(v, 1, key);
  assert.match(o.order_number, /^UPR-\d{4,}$/);
  assert.deepEqual(await order(v, 1, key), o);
  let { rows } = await db.query(
    "select stock,reserved from product_variants where id=$1",
    [v],
  );
  assert.deepEqual(rows[0], { stock: 2, reserved: 1 });
  await db.query("update products set price=99999,name='Changed' where id=$1", [
    p,
  ]);
  const saved = await db.query(
    "select product_name,unit_price from order_items where order_id=$1",
    [o.order_id],
  );
  assert.equal(saved.rows[0].product_name, "Test shirt");
  assert.equal(Number(saved.rows[0].unit_price), 25000);
  const pid = randomUUID();
  assert.equal(await payment(o, pid), "paid");
  assert.equal(await payment(o, pid), "already_applied");
  ({ rows } = await db.query(
    "select stock,reserved from product_variants where id=$1",
    [v],
  ));
  assert.deepEqual(rows[0], { stock: 1, reserved: 0 });
});
test("last unit cannot be reserved twice and failed transaction leaves no order", async () => {
  const { v } = await variant(1);
  await order(v);
  const before = await db.query("select count(*) as count from orders");
  await assert.rejects(order(v), /INSUFFICIENT_STOCK/);
  const after = await db.query("select count(*) as count from orders");
  assert.equal(after.rows[0].count, before.rows[0].count);
  await assert.rejects(
    db.query("update product_variants set stock=-1 where id=$1", [v]),
    /check constraint/,
  );
  await assert.rejects(
    db.query("update product_variants set stock=0 where id=$1", [v]),
    /check constraint/,
  );
});
test("malformed, duplicate, inactive and paused orders are rejected atomically", async () => {
  const { v, p } = await variant();
  await assert.rejects(order(v, 0), /INVALID_QUANTITY/);
  await assert.rejects(
    db.query("select create_order($1,$2,$3,$4)", [
      JSON.stringify([
        { variant_id: v, quantity: 1 },
        { variant_id: v, quantity: 1 },
      ]),
      JSON.stringify(customer),
      randomUUID(),
      "secret",
    ]),
    /DUPLICATE_VARIANT/,
  );
  await db.query("update products set active=false where id=$1", [p]);
  await assert.rejects(order(v), /PRODUCT_UNAVAILABLE/);
  await db.exec("update store_settings set sales_enabled=false");
  await assert.rejects(order(v), /SALES_PAUSED/);
  await db.exec("update store_settings set sales_enabled=true");
});
test("amount mismatch does not reduce stock and flags a review", async () => {
  const { v } = await variant();
  const o = await order(v);
  assert.equal(
    await payment(o, randomUUID(), "approved", 1),
    "review_required",
  );
  const result = await db.query(
    "select stock,reserved from product_variants where id=$1",
    [v],
  );
  assert.deepEqual(result.rows[0], { stock: 3, reserved: 1 });
  const state = await db.query(
    "select review_required,status from orders where id=$1",
    [o.order_id],
  );
  assert.equal(state.rows[0].review_required, true);
  assert.equal(state.rows[0].status, "pending");
});
test("duplicate approved payment flags review, refunds never silently restock", async () => {
  const { v } = await variant();
  const o = await order(v);
  const pid = randomUUID();
  await payment(o, pid);
  assert.equal(await payment(o, randomUUID()), "other_payment");
  assert.equal(await payment(o, pid, "refunded"), "refunded");
  const { rows } = await db.query(
    "select stock,reserved from product_variants where id=$1",
    [v],
  );
  assert.deepEqual(rows[0], { stock: 2, reserved: 0 });
});
test("only paid orders may be delivered; repeated delivery is safe", async () => {
  const { v } = await variant();
  const o = await order(v);
  await assert.rejects(
    asRole(
      "authenticated",
      () => db.query("select mark_delivered($1)", [o.order_id]),
      adminId,
    ),
    /NOT_PAID/,
  );
  await payment(o);
  await asRole(
    "authenticated",
    () => db.query("select mark_delivered($1)", [o.order_id]),
    adminId,
  );
  await asRole(
    "authenticated",
    () => db.query("select mark_delivered($1)", [o.order_id]),
    adminId,
  );
  assert.equal(
    (await db.query("select status from orders where id=$1", [o.order_id]))
      .rows[0].status,
    "delivered",
  );
  await assert.rejects(
    asRole("authenticated", () =>
      db.query("select mark_delivered($1)", [o.order_id]),
    ),
    /FORBIDDEN/,
  );
});
test("RLS hides customers and inactive products; public users cannot mutate sensitive records", async () => {
  const { v, p } = await variant();
  await db.query("update products set active=false where id=$1", [p]);
  await asRole("anon", async () => {
    assert.equal(
      (await db.query("select * from products where id=$1", [p])).rows.length,
      0,
    );
    await assert.rejects(db.query("select * from orders"), /permission denied/);
    await assert.rejects(
      db.query("update product_variants set stock=100 where id=$1", [v]),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select create_order($1,$2,$3,$4)", [
        "[]",
        "{}",
        randomUUID(),
        "token",
      ]),
      /permission denied/,
    );
  });
  await asRole("authenticated", async () => {
    assert.equal((await db.query("select * from orders")).rows.length, 0);
    await assert.rejects(
      db.query("update orders set status='paid'"),
      /permission denied/,
    );
  });
});
test("admin cannot directly edit reservations or payment status", async () => {
  const { v } = await variant();
  await asRole(
    "authenticated",
    async () => {
      await assert.rejects(
        db.query("update product_variants set reserved=2 where id=$1", [v]),
        /permission denied/,
      );
      await assert.rejects(
        db.query("update orders set payment_status='approved'"),
        /permission denied/,
      );
    },
    adminId,
  );
});
test("pending and rejected payment keep stock reserved; preference creation is claimed once", async () => {
  const { v } = await variant();
  const o = await order(v);
  assert.equal(await payment(o, randomUUID(), "pending"), "pending");
  assert.equal(await payment(o, randomUUID(), "rejected"), "pending");
  assert.equal(
    (await db.query("select claim_preference($1) as ok", [o.order_id])).rows[0]
      .ok,
    true,
  );
  assert.equal(
    (await db.query("select claim_preference($1) as ok", [o.order_id])).rows[0]
      .ok,
    false,
  );
  await assert.rejects(
    asRole(
      "authenticated",
      () => db.query("select cancel_unstarted_order($1)", [o.order_id]),
      adminId,
    ),
    /REQUIRES_PAYMENT_RECONCILIATION/,
  );
  const { rows } = await db.query(
    "select stock,reserved from product_variants where id=$1",
    [v],
  );
  assert.deepEqual(rows[0], { stock: 3, reserved: 1 });
});
test("safe cancellation releases only orders that never created a payment preference", async () => {
  const { v } = await variant();
  const o = await order(v);
  await asRole(
    "authenticated",
    () => db.query("select cancel_unstarted_order($1)", [o.order_id]),
    adminId,
  );
  const { rows } = await db.query(
    "select stock,reserved from product_variants where id=$1",
    [v],
  );
  assert.deepEqual(rows[0], { stock: 3, reserved: 0 });
});
