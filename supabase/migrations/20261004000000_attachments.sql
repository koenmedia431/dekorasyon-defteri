-- Sohbete yüklenen fiş / fatura / dekont dosyaları
alter table public.notes
  add column attachment_path text,
  add column attachment_name text;

-- Özel depolama alanı: dosyalar <kullanıcı id>/... klasöründe tutulur
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 20971520, array['image/*', 'application/pdf']);

create policy "attachments_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "attachments_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "attachments_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
