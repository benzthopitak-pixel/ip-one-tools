-- ============================================================
-- เปิด/ปิดเครื่องมือทั้งระบบ (แอดมินกดสวิตช์ในหน้า ตั้งค่า → เปิด/ปิดเครื่องมือ)
-- รันครั้งเดียวใน Supabase → SQL Editor · รันซ้ำได้
-- ============================================================
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
alter table public.app_settings enable row level security;

drop policy if exists app_settings_read  on public.app_settings;
drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_read  on public.app_settings for select to authenticated using (true);
create policy app_settings_write on public.app_settings for all    to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.app_settings from anon, public;
grant select, insert, update on public.app_settings to authenticated;

-- รายชื่อเครื่องมือที่ปิดอยู่ (เริ่มต้น = เปิดทุกตัว)
insert into public.app_settings (key, value) values ('tools_off', '[]'::jsonb)
  on conflict (key) do nothing;

select key, value from public.app_settings;
