-- Dekorasyon Defteri: müşteri cari hesapları, masraflar ve sohbet notları.
-- Her kayıt sahibine (user_id) aittir; RLS ile kullanıcı yalnızca kendi verisini görür.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- debit: müşteriye yazılan iş/fatura (borç), credit: müşteriden alınan ödeme (alacak)
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  entry_type text not null check (entry_type in ('debit', 'credit')),
  amount numeric(14, 2) not null check (amount > 0),
  description text not null default '',
  entry_date date not null default current_date,
  note_id uuid references public.notes (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Bu müşteri için bizim yaptığımız giderler; ekstrede görünmez
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  description text not null default '',
  category text,
  expense_date date not null default current_date,
  note_id uuid references public.notes (id) on delete set null,
  created_at timestamptz not null default now()
);

create index on public.customers (user_id);
create index on public.notes (customer_id);
create index on public.notes (user_id);
create index on public.transactions (customer_id);
create index on public.transactions (user_id);
create index on public.transactions (note_id);
create index on public.expenses (customer_id);
create index on public.expenses (user_id);
create index on public.expenses (note_id);

alter table public.customers enable row level security;
alter table public.notes enable row level security;
alter table public.transactions enable row level security;
alter table public.expenses enable row level security;

create policy "customers_own" on public.customers for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Alt kayıtlar: hem kendisi hem bağlı olduğu müşteri kullanıcıya ait olmalı
create policy "notes_own" on public.notes for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.customers c where c.id = customer_id and c.user_id = (select auth.uid()))
  );

create policy "transactions_own" on public.transactions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.customers c where c.id = customer_id and c.user_id = (select auth.uid()))
  );

create policy "expenses_own" on public.expenses for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.customers c where c.id = customer_id and c.user_id = (select auth.uid()))
  );

-- Sohbet: notu ve nottan çıkan kayıtları tek işlemde yazar (RLS geçerli).
-- p_entries: [{ "kind": "debit"|"credit"|"expense", "amount": 1000, "description": "...", "date": "2026-10-03" }]
create function public.add_note_with_entries(p_customer_id uuid, p_content text, p_entries jsonb)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_note uuid;
  e jsonb;
begin
  insert into public.notes (customer_id, content) values (p_customer_id, p_content)
  returning id into v_note;
  for e in select * from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) loop
    if e ->> 'kind' = 'expense' then
      insert into public.expenses (customer_id, amount, description, expense_date, note_id)
      values (p_customer_id, (e ->> 'amount')::numeric, coalesce(e ->> 'description', ''), (e ->> 'date')::date, v_note);
    else
      insert into public.transactions (customer_id, entry_type, amount, description, entry_date, note_id)
      values (p_customer_id, e ->> 'kind', (e ->> 'amount')::numeric, coalesce(e ->> 'description', ''), (e ->> 'date')::date, v_note);
    end if;
  end loop;
  return v_note;
end;
$$;

revoke execute on function public.add_note_with_entries(uuid, text, jsonb) from public, anon;
grant execute on function public.add_note_with_entries(uuid, text, jsonb) to authenticated;
