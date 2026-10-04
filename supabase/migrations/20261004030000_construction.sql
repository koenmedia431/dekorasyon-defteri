-- İnşaat / dekorasyon projeleri: proje adı, sözleşme bedeli, tarihler; masraf kategorisi sohbetten
alter table public.customers
  add column project_title text,
  add column contract_amount numeric(14, 2) check (contract_amount is null or contract_amount >= 0),
  add column start_date date,
  add column due_date date;

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
      insert into public.expenses (customer_id, amount, description, category, expense_date, note_id)
      values (p_customer_id, (e ->> 'amount')::numeric, coalesce(e ->> 'description', ''), nullif(e ->> 'category', ''), (e ->> 'date')::date, v_note);
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
