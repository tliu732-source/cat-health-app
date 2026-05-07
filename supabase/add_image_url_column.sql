-- 在 Supabase 控制台 → SQL Editor 中执行本文件，修复：
-- 加载失败：column cats.image_url does not exist

alter table public.cats
  add column if not exists image_url text;

comment on column public.cats.image_url is '猫咪头像公开 URL（Supabase Storage）';
