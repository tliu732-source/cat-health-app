-- Supabase → SQL Editor：创建公开读、匿名可上传的「猫咪头像」存储桶（开发用，上线请收紧策略）。

insert into storage.buckets (id, name, public)
values ('cat-images', 'cat-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "cat-images select" on storage.objects;
drop policy if exists "cat-images insert" on storage.objects;
drop policy if exists "cat-images update" on storage.objects;
drop policy if exists "cat-images delete" on storage.objects;

create policy "cat-images select"
on storage.objects for select
using (bucket_id = 'cat-images');

create policy "cat-images insert"
on storage.objects for insert
with check (bucket_id = 'cat-images');

create policy "cat-images update"
on storage.objects for update
using (bucket_id = 'cat-images')
with check (bucket_id = 'cat-images');

create policy "cat-images delete"
on storage.objects for delete
using (bucket_id = 'cat-images');
