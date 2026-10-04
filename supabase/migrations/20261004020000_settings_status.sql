-- Firma bilgileri (ekstre anteti) ve proje durumu

create table public.business_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  name text not null default '',
  phone text,
  email text,
  address text,
  tax_office text,
  tax_no text,
  iban text,
  bank_name text,
  logo_path text,
  statement_note text,
  updated_at timestamptz not null default now()
);

alter table public.business_settings enable row level security;

create policy "business_settings_own" on public.business_settings for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Proje durumu: teklif aşamasında / devam ediyor / tamamlandı
alter table public.customers
  add column status text not null default 'active' check (status in ('quote', 'active', 'done'));

create index on public.customers (user_id, status);
