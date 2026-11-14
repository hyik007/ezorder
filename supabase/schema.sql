-- EZorder database. Paste this whole file into Supabase > SQL Editor > New query > Run.
--
-- Running it again RESETS every table's cart and orders (the menu is kept).
-- That is deliberate: it lets you start a demo day clean.

-- ---------------------------------------------------------------- tables

create table if not exists public.menu_items (
  id          text primary key,
  kind        text not null default 'food' check (kind in ('food', 'drink')),
  category    text not null default 'rice',   -- tab in the Normal Menu: rice, noodles, drinks
  name_en     text not null,
  name_ms     text not null,
  name_zh     text not null,
  desc_en     text not null default '',
  desc_ms     text not null default '',
  desc_zh     text not null default '',
  price       numeric(8, 2) not null check (price >= 0),
  image_url   text not null,           -- "/menu/laksa.png" or a Supabase Storage public URL
  aliases     text[] not null default '{}',  -- what people say out loud, for voice ordering
  sort        int not null default 0,
  available   boolean not null default true
);

alter table public.menu_items add column if not exists category text not null default 'rice';

drop table if exists public.voice_feedback, public.cart_items, public.orders, public.table_sessions cascade;

-- One row per sitting at a physical table. The table code is what is printed on the QR card.
-- A table has at most one open sitting; scanning the QR joins it (see join_table below).
create table public.table_sessions (
  id          uuid primary key default gen_random_uuid(),
  table_code  text not null check (table_code ~ '^[A-Z0-9]{1,4}$'),
  created_at  timestamptz not null default now(),
  closed_at   timestamptz
);
create unique index one_open_sitting_per_table
  on public.table_sessions (table_code) where closed_at is null;

create table public.orders (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.table_sessions (id) on delete cascade,
  table_code    text not null,
  total         numeric(10, 2) not null,
  confirmed_by  uuid not null,
  created_at    timestamptz not null default now()
);

-- The table's shared cart. order_id is null while a line is still being chosen.
-- Removing a dish sets qty to 0 instead of deleting, so every phone hears about it.
create table public.cart_items (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.table_sessions (id) on delete cascade,
  table_code     text not null,          -- repeated here so Realtime can filter by table
  item_id        text not null references public.menu_items (id),
  qty            int not null default 1 check (qty between 0 and 20),
  notes          text[] not null default '{}',
  added_by       uuid not null default auth.uid(),
  added_by_name  text not null check (char_length(added_by_name) between 1 and 40),
  source         text not null default 'tap' check (source in ('tap', 'voice')),
  via            text not null default 'normal' check (via in ('easy', 'normal')),  -- which menu it came from
  order_id       uuid references public.orders (id),
  created_at     timestamptz not null default now()
);

-- Every voice order's outcome: accepted as heard, or corrected by choosing from photos. Read it in the dashboard to find
-- phrases the matcher gets wrong, then add them to menu_items.aliases. Diners cannot read it.
create table public.voice_feedback (
  id          bigint generated always as identity primary key,
  table_code  text not null,
  heard       text not null check (char_length(heard) <= 300),
  proposed    jsonb not null default '[]',
  chosen      jsonb,                 -- what the diner picked instead, when they corrected it
  accepted    boolean not null,
  engine      text not null default '',
  created_by  uuid not null default auth.uid(),
  created_at  timestamptz not null default now()
);

create index cart_items_session_idx on public.cart_items (session_id);
create index orders_session_idx on public.orders (session_id, created_at desc);

-- ---------------------------------------------------------------- who may do what

alter table public.menu_items     enable row level security;
alter table public.table_sessions enable row level security;
alter table public.cart_items     enable row level security;
alter table public.orders         enable row level security;
alter table public.voice_feedback enable row level security;

grant select                 on public.menu_items     to anon, authenticated;
grant select                 on public.table_sessions to authenticated;
grant select, insert, update on public.cart_items     to authenticated;
grant select                 on public.orders         to authenticated;
grant insert                 on public.voice_feedback to authenticated;

-- Menu: anyone can read it. Edit it from the Supabase dashboard.
drop policy if exists "menu is public" on public.menu_items;
create policy "menu is public" on public.menu_items
  for select to anon, authenticated using (true);

-- Sittings and orders: readable by signed-in phones (anonymous sign-in counts).
-- They are only ever created or closed by the functions below.
create policy "read sittings" on public.table_sessions
  for select to authenticated using (true);
create policy "read orders" on public.orders
  for select to authenticated using (true);

create policy "log your own voice feedback" on public.voice_feedback
  for insert to authenticated with check (created_by = (select auth.uid()));

-- Cart: read it, and add picks under your own identity to a sitting that is still open.
create policy "read cart" on public.cart_items
  for select to authenticated using (true);

create policy "add your own picks" on public.cart_items
  for insert to authenticated
  with check (
    added_by = (select auth.uid())
    and order_id is null
    and exists (
      select 1 from public.table_sessions s
      where s.id = cart_items.session_id
        and s.table_code = cart_items.table_code
        and s.closed_at is null
    )
  );

-- Anyone at the table may change quantities until the order is sent, the same way anyone
-- at a real table can say "make that two". Sent lines are locked.
-- Hackathon simplification: "at the table" means "knows the table code".
create policy "change open picks" on public.cart_items
  for update to authenticated
  using (
    order_id is null
    and exists (
      select 1 from public.table_sessions s
      where s.id = cart_items.session_id and s.closed_at is null
    )
  )
  with check (order_id is null);

-- ---------------------------------------------------------------- functions

-- Scanning the table QR calls this. It returns the table's open sitting, starting a new one
-- if there is none or if the last one has been idle for 3 hours (the previous guests left).
create or replace function public.join_table(p_table text)
returns public.table_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.table_sessions;
  v_last    timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  if p_table is null or p_table !~ '^[A-Z0-9]{1,4}$' then
    raise exception 'Unknown table';
  end if;

  select * into v_session
    from public.table_sessions
   where table_code = p_table and closed_at is null;

  if found then
    select greatest(
             v_session.created_at,
             (select max(created_at) from public.cart_items where session_id = v_session.id),
             (select max(created_at) from public.orders where session_id = v_session.id))
      into v_last;
    if v_last > now() - interval '3 hours' then
      return v_session;
    end if;
    update public.table_sessions set closed_at = now() where id = v_session.id;
  end if;

  begin
    insert into public.table_sessions (table_code) values (p_table) returning * into v_session;
  exception when unique_violation then
    -- Another phone at the table got there first. Join theirs.
    select * into v_session
      from public.table_sessions
     where table_code = p_table and closed_at is null;
  end;
  return v_session;
end;
$$;

-- "Send to kitchen" calls this. It prices the cart from the menu table (never from the
-- phone), creates the order, and locks the lines, in one step.
create or replace function public.confirm_order(p_table text)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session uuid;
  v_total   numeric(10, 2);
  v_count   int;
  v_order   public.orders;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;

  select id into v_session
    from public.table_sessions
   where table_code = p_table and closed_at is null
     for update;
  if not found then
    raise exception 'Table not found';
  end if;

  select coalesce(sum(c.qty * m.price), 0), count(*)
    into v_total, v_count
    from public.cart_items c
    join public.menu_items m on m.id = c.item_id
   where c.session_id = v_session and c.order_id is null and c.qty > 0;
  if v_count = 0 then
    raise exception 'There is nothing to send yet';
  end if;

  insert into public.orders (session_id, table_code, total, confirmed_by)
  values (v_session, p_table, v_total, auth.uid())
  returning * into v_order;

  update public.cart_items
     set order_id = v_order.id
   where session_id = v_session and order_id is null and qty > 0;

  return v_order;
end;
$$;

-- Staff: the kitchen has run out of a dish, or it is back on.
-- Hackathon simplification: any signed-in phone can call this, like clear_table.
-- A real build would restrict it to a staff login.
create or replace function public.set_item_stock(p_item text, p_in_stock boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  update public.menu_items set available = p_in_stock where id = p_item;
end;
$$;

-- Staff: the guests have left. The next scan of this table's QR starts empty.
-- Hackathon simplification: any signed-in phone can call this. A real build would
-- restrict it to a staff login.
create or replace function public.clear_table(p_table text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  update public.table_sessions set closed_at = now()
   where table_code = p_table and closed_at is null;
end;
$$;

revoke all on function public.set_item_stock(text, boolean) from public, anon;
grant execute on function public.set_item_stock(text, boolean) to authenticated;

revoke all on function public.join_table(text)    from public, anon;
revoke all on function public.confirm_order(text) from public, anon;
revoke all on function public.clear_table(text)   from public, anon;
grant execute on function public.join_table(text)    to authenticated;
grant execute on function public.confirm_order(text) to authenticated;
grant execute on function public.clear_table(text)   to authenticated;

-- ---------------------------------------------------------------- realtime

-- Tell Supabase Realtime to broadcast changes at the table, and sold-out marks on the menu.
do $$
declare
  t text;
begin
  foreach t in array array['cart_items', 'orders', 'table_sessions', 'menu_items'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------- sample menu

insert into public.menu_items
  (id, kind, category, name_en, name_ms, name_zh, desc_en, desc_ms, desc_zh, price, image_url, aliases, sort)
values
  ('nasi-lemak', 'food', 'rice', 'Nasi Lemak', 'Nasi Lemak', '椰浆饭',
   'Coconut rice, fried chicken, sambal, egg', 'Nasi santan, ayam goreng, sambal, telur', '椰浆饭、炸鸡、参巴辣椒、鸡蛋',
   8.90, '/menu/nasi-lemak.png', array['nasi lemak deluxe','nasi lemak','nasilemak','椰浆饭','椰漿飯','நாசி லெமாக்'], 1),
  ('chicken-rice', 'food', 'rice', 'Chicken Rice', 'Nasi Ayam', '鸡饭',
   'Poached chicken, fragrant rice, chilli sauce', 'Ayam rebus, nasi wangi, sos cili', '白斩鸡、油饭、辣椒酱',
   6.50, '/menu/chicken-rice.png', array['chicken rice','nasi ayam','海南鸡饭','鸡饭','雞飯','ji fan','kai fan','koi png','kai png','சிக்கன் ரைஸ்'], 2),
  ('laksa', 'food', 'noodles', 'Laksa', 'Laksa', '叻沙',
   'Spiced coconut noodle soup with prawns', 'Mi kuah santan berempah dengan udang', '香辣椰浆汤面，配鲜虾',
   7.20, '/menu/laksa.png', array['laksa','叻沙','喇沙','拉沙','辣沙','லக்சா'], 3),
  ('teh-tarik', 'drink', 'drinks', 'Teh Tarik', 'Teh Tarik', '拉茶',
   'Hand-pulled milk tea, served hot', 'Teh susu tarik, dihidang panas', '手拉奶茶，热饮',
   2.50, '/menu/teh-tarik.png', array['teh tarik','pulled tea','milk tea','拉茶','奶茶','தே தாரிக்','teh','tea'], 4)
on conflict (id) do update
  set category = excluded.category, aliases = excluded.aliases;
