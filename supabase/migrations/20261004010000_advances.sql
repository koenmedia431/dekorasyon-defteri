-- Ortak avansları: hangi ortağın (Cihad, Mücahid, Emir) hangi projeden ne kadar aldığı.
-- Müşteri bakiyesini etkilemez, ekstrede görünmez.
create table public.advances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  partner text not null check (length(trim(partner)) > 0),
  amount numeric(14, 2) not null check (amount > 0),
  description text not null default '',
  advance_date date not null default current_date,
  note_id uuid references public.notes (id) on delete set null,
  created_at timestamptz not null default now()
);

create index on public.advances (customer_id);
create index on public.advances (user_id);
create index on public.advances (note_id);

alter table public.advances enable row level security;

create policy "advances_own" on public.advances for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.customers c where c.id = customer_id and c.user_id = (select auth.uid()))
  );

-- Sohbet fonksiyonu artık "advance" türünü de yazar (e->>'partner' zorunlu)
create or replace function public.add_note_with_entries(p_customer_id uuid, p_content text, p_entries jsonb)
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
    elsif e ->> 'kind' = 'advance' then
      insert into public.advances (customer_id, partner, amount, description, advance_date, note_id)
      values (p_customer_id, e ->> 'partner', (e ->> 'amount')::numeric, coalesce(e ->> 'description', ''), (e ->> 'date')::date, v_note);
    else
      insert into public.transactions (customer_id, entry_type, amount, description, entry_date, note_id)
      values (p_customer_id, e ->> 'kind', (e ->> 'amount')::numeric, coalesce(e ->> 'description', ''), (e ->> 'date')::date, v_note);
    end if;
  end loop;
  return v_note;
end;
$$;
