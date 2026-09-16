-- Public checkout rate limits. Buckets contain hashes, never raw addresses.
create table public.checkout_rate_limits (
 bucket text primary key, window_start timestamptz not null default now(), attempts integer not null default 1
);
alter table public.checkout_rate_limits enable row level security;
revoke all on public.checkout_rate_limits from anon,authenticated;
create function public.checkout_rate_limit(p_bucket text, p_limit integer) returns boolean
language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 insert into checkout_rate_limits(bucket) values(p_bucket)
 on conflict(bucket) do update set attempts=case when checkout_rate_limits.window_start < now()-interval '15 minutes' then 1 else checkout_rate_limits.attempts+1 end,
 window_start=case when checkout_rate_limits.window_start < now()-interval '15 minutes' then now() else checkout_rate_limits.window_start end
 returning attempts into n;
 delete from checkout_rate_limits where window_start<now()-interval '1 day';
 return n<=p_limit;
end $$;
revoke all on function public.checkout_rate_limit(text,integer) from public,anon,authenticated;
grant execute on function public.checkout_rate_limit(text,integer) to service_role;

-- Validate retry payload before returning an existing order. Prevent accidental reuse for another cart.
alter function public.create_order(jsonb,jsonb,uuid,text) rename to create_order_internal;
create function public.create_order(p_items jsonb,p_customer jsonb,p_request_key uuid,p_access_token text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare o orders; existing_items jsonb; incoming_items jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_request_key::text,0));
 select * into o from orders where request_key=p_request_key;
 if found then
  if o.status<>'pending' then raise exception 'EXISTING_ORDER'; end if;
  select jsonb_agg(jsonb_build_object('variant_id',variant_id,'quantity',quantity) order by variant_id) into existing_items from order_items where order_id=o.id;
  select jsonb_agg(jsonb_build_object('variant_id',x->>'variant_id','quantity',(x->>'quantity')::integer) order by x->>'variant_id') into incoming_items from jsonb_array_elements(p_items) x;
  if existing_items<>incoming_items or o.email<>lower(trim(p_customer->>'email')) or o.customer_name<>trim(p_customer->>'customer_name') or o.customer_last_name<>trim(p_customer->>'customer_last_name') or o.phone<>trim(p_customer->>'phone') then raise exception 'EXISTING_ORDER'; end if;
 end if;
 return create_order_internal(p_items,p_customer,p_request_key,p_access_token);
end $$;
revoke all on function public.create_order(jsonb,jsonb,uuid,text) from public,anon,authenticated;
grant execute on function public.create_order(jsonb,jsonb,uuid,text) to service_role;
revoke all on function public.create_order_internal(jsonb,jsonb,uuid,text) from public,anon,authenticated,service_role;

-- Ensure counters keep growing after UPR-9999 instead of truncating.
create function public.next_order_number() returns text language sql volatile set search_path=public as $$
 select 'UPR-' || lpad(n,greatest(4,length(n)),'0') from (select nextval('public.order_number_seq')::text n) s;
$$;
alter table public.orders alter column order_number set default public.next_order_number();

-- Explicit privileges independent of a project's default grants.
revoke all on public.products,public.product_images,public.store_settings from anon,authenticated;
grant select on public.products,public.product_images,public.store_settings to anon,authenticated;
grant insert,update on public.products to authenticated;
grant insert,update,delete on public.product_images to authenticated;
grant update on public.store_settings to authenticated;
revoke all on sequence public.order_number_seq from public,anon,authenticated;
revoke all on function public.next_order_number() from public,anon,authenticated;
grant execute on function public.next_order_number() to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

create function public.recover_preference(p_order_id uuid,p_preference_id text,p_init_point text) returns void
language plpgsql security definer set search_path=public as $$
declare o orders;
begin
 select * into o from orders where id=p_order_id for update;
 if not found or o.preference_state not in ('creating','uncertain') or o.mercadopago_preference_id is not null then return; end if;
 update orders set mercadopago_preference_id=p_preference_id,init_point=p_init_point,preference_state='ready',
 review_required=exists(select 1 from payment_events where order_id=p_order_id and review_reason is not null)
 where id=p_order_id;
end $$;
revoke all on function public.recover_preference(uuid,text,text) from public,anon,authenticated;
grant execute on function public.recover_preference(uuid,text,text) to service_role;
