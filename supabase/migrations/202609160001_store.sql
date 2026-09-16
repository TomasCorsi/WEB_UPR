-- All checkout mutations are atomic service-only RPCs. Public clients never write orders.
create table public.admin_users (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.admin_users enable row level security;
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from admin_users where user_id = auth.uid()); $$;
create policy own_admin on public.admin_users for select to authenticated using (user_id = auth.uid());

create table public.products (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 160),
 slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), description text not null default '',
 price numeric(12,2) not null check(price > 0), active boolean not null default false, featured boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.product_variants (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete restrict,
 color text not null check(length(color) between 1 and 60), color_hex text not null default '#222222' check(color_hex ~ '^#[0-9a-fA-F]{6}$'),
 size text not null check(length(size) between 1 and 20), sku text not null unique,
 stock integer not null default 0 check(stock >= 0), reserved integer not null default 0 check(reserved >= 0 and reserved <= stock),
 active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(product_id, color, size)
);
create table public.product_images (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
 image_url text not null check(image_url ~ '^https?://'), color text, position integer not null default 0, created_at timestamptz not null default now()
);
create table public.store_settings (
 id boolean primary key default true check(id), event_name text not null default 'UPR 2026', event_date text not null default '', event_location text not null default '',
 instagram text not null default '' check(instagram = '' or instagram ~ '^https://(www\.)?instagram\.com/'), whatsapp text not null default '' check(whatsapp = '' or whatsapp ~ '^[+0-9 ()-]{8,30}$'),
 sales_enabled boolean not null default false, pickup_message text not null default 'Todas las compras se retiran personalmente el día de UPR 2026.',
 size_guide jsonb not null default '[]' check(jsonb_typeof(size_guide) = 'array'), returns_text text not null default '', privacy_text text not null default '', terms_text text not null default ''
);
insert into public.store_settings(id) values(true);
create sequence public.order_number_seq;
create table public.orders (
 id uuid primary key default gen_random_uuid(), order_number text not null unique default ('UPR-' || lpad(nextval('public.order_number_seq')::text, 4, '0')),
 request_key uuid not null unique, access_token text not null,
 customer_name text not null check(length(customer_name) between 1 and 80), customer_last_name text not null check(length(customer_last_name) between 1 and 80),
 phone text not null check(length(phone) between 8 and 30), email text not null check(length(email) <= 200 and position('@' in email) > 1),
 total numeric(12,2) not null default 0 check(total >= 0), payment_status text not null default 'pending' check(payment_status in ('pending','approved','rejected','cancelled','refunded','charged_back')),
 status text not null default 'pending' check(status in ('pending','paid','delivered','cancelled')),
 mercadopago_preference_id text unique, mercadopago_payment_id text unique, init_point text,
 preference_state text not null default 'new' check(preference_state in ('new','creating','ready','uncertain')),
 reserved boolean not null default true, stock_applied boolean not null default false, review_required boolean not null default false,
 created_at timestamptz not null default now(), paid_at timestamptz, delivered_at timestamptz, updated_at timestamptz not null default now()
);
create table public.order_items (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete restrict,
 product_id uuid not null references public.products(id) on delete restrict, variant_id uuid not null references public.product_variants(id) on delete restrict,
 product_name text not null, color text not null, size text not null, quantity integer not null check(quantity between 1 and 20),
 unit_price numeric(12,2) not null check(unit_price > 0), subtotal numeric(12,2) not null check(subtotal = unit_price * quantity), created_at timestamptz not null default now(), unique(order_id, variant_id)
);
create table public.payment_events (
 payment_id text primary key, order_id uuid not null references public.orders(id), status text not null, amount numeric(12,2) not null, review_reason text,
 updated_at timestamptz not null default now()
);
create index orders_lookup on public.orders(status, created_at desc);
create index orders_email on public.orders(email);
create index orders_phone on public.orders(phone);
create index items_order on public.order_items(order_id);
create index variants_product on public.product_variants(product_id);
create index images_product on public.product_images(product_id);
create function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();
create trigger variants_touch before update on public.product_variants for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.store_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_events enable row level security;
create policy public_products on public.products for select using (active or public.is_admin());
create policy admin_products on public.products for all to authenticated using (public.is_admin()) with check(public.is_admin());
create policy public_variants on public.product_variants for select using ((active and exists(select 1 from public.products p where p.id=product_id and p.active)) or public.is_admin());
create policy admin_variants on public.product_variants for all to authenticated using (public.is_admin()) with check(public.is_admin());
create policy public_images on public.product_images for select using (exists(select 1 from public.products p where p.id=product_id and p.active) or public.is_admin());
create policy admin_images on public.product_images for all to authenticated using (public.is_admin()) with check(public.is_admin());
create policy public_settings on public.store_settings for select using(true);
create policy admin_settings on public.store_settings for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_orders on public.orders for select to authenticated using(public.is_admin());
create policy admin_items on public.order_items for select to authenticated using(public.is_admin());
create policy admin_payments on public.payment_events for select to authenticated using(public.is_admin());

-- Limit admin direct edits to stock; reserved is exclusively managed by RPCs.
revoke all on public.orders, public.order_items, public.payment_events, public.admin_users from anon, authenticated;
grant select on public.orders, public.order_items, public.payment_events, public.admin_users to authenticated;
revoke all on public.product_variants from anon, authenticated;
grant select on public.product_variants to anon, authenticated;
grant insert (product_id,color,color_hex,size,sku,stock,active), update(color,color_hex,size,sku,stock,active) on public.product_variants to authenticated;
grant select on public.products, public.product_images, public.store_settings to anon, authenticated;
grant insert, update on public.products to authenticated;
grant insert, update, delete on public.product_images to authenticated;
grant update on public.store_settings to authenticated;

create function public.create_order(p_items jsonb, p_customer jsonb, p_request_key uuid, p_access_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o orders; line record; v product_variants; p products; qty integer; total_value numeric := 0;
begin
 -- One lock for retry identity; sorted variant locks avoid deadlocks across carts.
 perform pg_advisory_xact_lock(hashtextextended(p_request_key::text, 0));
 select * into o from orders where request_key = p_request_key;
 if found then return jsonb_build_object('order_id',o.id,'order_number',o.order_number,'access_token',o.access_token); end if;
 perform 1 from store_settings where id and sales_enabled for share;
 if not found then raise exception 'SALES_PAUSED'; end if;
 if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 20 then raise exception 'INVALID_CART'; end if;
 if (select count(distinct x->>'variant_id') from jsonb_array_elements(p_items) x) <> jsonb_array_length(p_items) then raise exception 'DUPLICATE_VARIANT'; end if;
 insert into orders(request_key,access_token,customer_name,customer_last_name,phone,email)
 values(p_request_key,p_access_token,trim(p_customer->>'customer_name'),trim(p_customer->>'customer_last_name'),trim(p_customer->>'phone'),lower(trim(p_customer->>'email'))) returning * into o;
 for line in select value from jsonb_array_elements(p_items) order by value->>'variant_id' loop
  if (line.value->>'quantity') !~ '^[0-9]+$' then raise exception 'INVALID_QUANTITY'; end if;
  qty := (line.value->>'quantity')::integer;
  if qty not between 1 and 20 then raise exception 'INVALID_QUANTITY'; end if;
  select * into v from product_variants where id = (line.value->>'variant_id')::uuid for update;
  if not found or not v.active or v.stock - v.reserved < qty then raise exception 'INSUFFICIENT_STOCK'; end if;
  select * into p from products where id = v.product_id for share;
  if not p.active then raise exception 'PRODUCT_UNAVAILABLE'; end if;
  insert into order_items(order_id,product_id,variant_id,product_name,color,size,quantity,unit_price,subtotal)
  values(o.id,p.id,v.id,p.name,v.color,v.size,qty,p.price,p.price*qty);
  update product_variants set reserved=reserved+qty where id=v.id;
  total_value := total_value + p.price*qty;
 end loop;
 update orders set total=total_value where id=o.id;
 return jsonb_build_object('order_id',o.id,'order_number',o.order_number,'access_token',o.access_token);
end $$;

create function public.claim_preference(p_order_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
begin
 update orders set preference_state='creating' where id=p_order_id and status='pending' and reserved and preference_state='new';
 return found;
end $$;

create function public.apply_payment(p_order_id uuid, p_payment_id text, p_status text, p_amount numeric, p_currency text) returns text
language plpgsql security definer set search_path=public as $$
declare o orders; item record; available_count integer;
begin
 select * into o from orders where id=p_order_id for update;
 if not found then raise exception 'ORDER_NOT_FOUND'; end if;
 if exists(select 1 from payment_events where payment_id=p_payment_id and order_id<>p_order_id) then raise exception 'PAYMENT_REUSED'; end if;
 insert into payment_events(payment_id,order_id,status,amount) values(p_payment_id,o.id,p_status,p_amount)
 on conflict(payment_id) do update set status=excluded.status,amount=excluded.amount,updated_at=now();
 if p_amount<>o.total or p_currency<>'ARS' then
  update orders set review_required=true where id=o.id;
  update payment_events set review_reason='AMOUNT_OR_CURRENCY_MISMATCH' where payment_id=p_payment_id;
  return 'review_required';
 end if;
 if o.mercadopago_payment_id is not null and o.mercadopago_payment_id<>p_payment_id then
  if p_status='approved' then
   update orders set review_required=true where id=o.id;
   update payment_events set review_reason='DUPLICATE_APPROVED_PAYMENT_REFUND_REQUIRED' where payment_id=p_payment_id;
  end if;
  return 'other_payment';
 end if;
 if p_status='approved' then
  if o.stock_applied then return 'already_applied'; end if;
  -- Reservations do not expire automatically: a pending payment may approve later.
  perform 1 from product_variants where id in(select variant_id from order_items where order_id=o.id) order by id for update;
  for item in select * from order_items where order_id=o.id loop
   select stock-reserved + case when o.reserved then item.quantity else 0 end into available_count from product_variants where id=item.variant_id;
   if available_count<item.quantity then
    update orders set review_required=true, payment_status='approved',mercadopago_payment_id=p_payment_id where id=o.id;
    update payment_events set review_reason='STOCK_CONFLICT_REFUND_REQUIRED' where payment_id=p_payment_id;
    return 'review_required';
   end if;
  end loop;
  for item in select * from order_items where order_id=o.id loop
   update product_variants set stock=stock-item.quantity,reserved=reserved-case when o.reserved then item.quantity else 0 end where id=item.variant_id;
  end loop;
  update orders set status='paid', payment_status='approved', mercadopago_payment_id=p_payment_id, stock_applied=true, reserved=false, paid_at=now() where id=o.id;
  return 'paid';
 elsif p_status in ('refunded','charged_back') then
  update orders set payment_status=p_status,review_required=true where id=o.id;
  update payment_events set review_reason='REFUND_OR_CHARGEBACK_REVIEW_STOCK_MANUALLY' where payment_id=p_payment_id;
  return p_status;
 elsif not o.stock_applied then
  -- Keep the hold: an existing Checkout Pro preference can receive another attempt.
  update orders set payment_status=case when p_status in ('rejected','cancelled') then p_status else 'pending' end where id=o.id;
 end if;
 return 'pending';
end $$;

create function public.mark_delivered(p_order_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 update orders set status='delivered',delivered_at=now() where id=p_order_id and status='paid' and payment_status='approved' and stock_applied and not review_required;
 if not found and not exists(select 1 from orders where id=p_order_id and status='delivered') then raise exception 'NOT_PAID'; end if;
end $$;

-- Safe release only for orders which never started preference creation.
create function public.cancel_unstarted_order(p_order_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare o orders; item record;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 select * into o from orders where id=p_order_id for update;
 if not found or o.status<>'pending' or o.preference_state<>'new' then raise exception 'REQUIRES_PAYMENT_RECONCILIATION'; end if;
 perform 1 from product_variants where id in(select variant_id from order_items where order_id=o.id) order by id for update;
 for item in select * from order_items where order_id=o.id loop
  update product_variants set reserved=reserved-item.quantity where id=item.variant_id;
 end loop;
 update orders set status='cancelled',payment_status='cancelled',reserved=false where id=o.id;
end $$;

-- No public execution of security-definer checkout/payment functions.
revoke all on function public.create_order(jsonb,jsonb,uuid,text), public.claim_preference(uuid), public.apply_payment(uuid,text,text,numeric,text) from public, anon, authenticated;
grant execute on function public.create_order(jsonb,jsonb,uuid,text), public.claim_preference(uuid), public.apply_payment(uuid,text,text,numeric,text) to service_role;
revoke all on function public.mark_delivered(uuid),public.cancel_unstarted_order(uuid) from public,anon;
grant execute on function public.mark_delivered(uuid),public.cancel_unstarted_order(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('products','products',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy products_read on storage.objects for select using(bucket_id='products');
create policy products_upload on storage.objects for insert to authenticated with check(bucket_id='products' and public.is_admin());
create policy products_update on storage.objects for update to authenticated using(bucket_id='products' and public.is_admin()) with check(bucket_id='products' and public.is_admin());
create policy products_delete on storage.objects for delete to authenticated using(bucket_id='products' and public.is_admin());
