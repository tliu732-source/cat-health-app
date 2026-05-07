-- Run this in Supabase → SQL Editor if the `cats` table does not exist yet.
-- 若已有表且 age 为 integer，可执行：
-- alter table public.cats alter column age type numeric using age::numeric;

create table if not exists public.cats (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  breed text not null default '',
  age numeric not null default 0,
  weight double precision not null default 0,
  image_url text,
  created_at timestamptz not null default now()
);

-- 已有表时补充头像地址列：
-- alter table public.cats add column if not exists image_url text;

alter table public.cats enable row level security;

drop policy if exists "cats_select" on public.cats;
drop policy if exists "cats_insert" on public.cats;
drop policy if exists "cats_update" on public.cats;
drop policy if exists "cats_delete" on public.cats;

create policy "cats_select" on public.cats for select using (true);
create policy "cats_insert" on public.cats for insert with check (true);
create policy "cats_update" on public.cats for update using (true) with check (true);
create policy "cats_delete" on public.cats for delete using (true);
