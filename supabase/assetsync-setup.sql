-- ============================================================
-- รวม AssetSync เข้าฐานข้อมูลเดียวกับ Portal (รันครั้งเดียว · รันซ้ำได้)
-- - ล็อกอินด้วยรหัสพนักงาน + รหัสผ่าน ชุดเดียวทุกเว็บ
-- - AssetSync ไม่มีหัวหน้า: ทุกคนที่มีสิทธิ์เข้า AssetSync ทำได้ทุกอย่าง
-- - เริ่มข้อมูล AssetSync ใหม่ (ไม่ย้ายข้อมูลจากฐานข้อมูลเดิม)
-- ============================================================

-- ---------- 1) ชื่อ-นามสกุลของผู้ใช้ (AssetSync ใช้แสดงว่าใครสแกน) ----------
alter table public.profiles add column if not exists name text;

-- ---------- 2) สิทธิ์ AssetSync: ทุกคนที่เข้าเครื่องมือ assetsync ได้ = ทำได้ทุกอย่าง ----------
create or replace function public.ams_role() returns text
language sql stable security definer set search_path = public as $$
  select 'lead' from public.profiles p
  where p.id = auth.uid()
    and (p.role = 'admin' or p.tools is null or p.tools ? 'assetsync')
$$;

-- รายชื่อทีมในรูปแบบที่ AssetSync ใช้ (code = รหัสพนักงาน)
create or replace view public.ams_profiles as
  select p.id,
         p.username as code,
         coalesce(nullif(p.name,''), p.username) as name,
         'lead'::text as role,
         (p.role = 'admin' or p.tools is null or p.tools ? 'assetsync') as active
  from public.profiles p
  where auth.uid() is not null;
revoke all on public.ams_profiles from anon, public;
grant select on public.ams_profiles to authenticated;

create or replace function public.ams_has_users() returns boolean
language sql stable security definer set search_path = public as $$ select true $$;
grant execute on function public.ams_has_users() to anon, authenticated;

-- ---------- 3) ตารางข้อมูล AssetSync ----------
create table if not exists public.ams_kv (
  key        text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
create table if not exists public.ams_events (
  id          text primary key,
  round       text not null,
  dev         text not null,
  t           bigint not null,
  k           text not null check (k in ('scan', 'edit', 'del', 'rv')),
  code        text not null,
  by_name     text,
  data        jsonb not null,
  created_by  uuid default auth.uid(),
  received_at timestamptz not null default now()
);
create index if not exists ams_events_round_idx on public.ams_events (round, t);
create index if not exists ams_events_round_dev_idx on public.ams_events (round, dev);

alter table public.ams_kv     enable row level security;
alter table public.ams_events enable row level security;

drop policy if exists ams_kv_all on public.ams_kv;
create policy ams_kv_all on public.ams_kv for all
  using (public.ams_role() is not null) with check (public.ams_role() is not null);

drop policy if exists ams_events_read   on public.ams_events;
drop policy if exists ams_events_insert on public.ams_events;
drop policy if exists ams_events_delete on public.ams_events;
create policy ams_events_read   on public.ams_events for select using (public.ams_role() is not null);
create policy ams_events_insert on public.ams_events for insert with check (public.ams_role() is not null);
create policy ams_events_delete on public.ams_events for delete using (public.ams_role() is not null);

grant select, insert, update, delete on public.ams_kv     to authenticated;
grant select, insert, delete         on public.ams_events to authenticated;

do $$ begin alter publication supabase_realtime add table public.ams_kv;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.ams_events;
exception when duplicate_object then null; when undefined_object then null; end $$;

create or replace function public.ams_count_by_dev(p_round text, p_dev text) returns bigint
language sql stable security invoker set search_path = public as $$
  select count(*) from public.ams_events where round = p_round and dev = p_dev
$$;

-- ---------- 4) Portal: สร้างผู้ใช้พร้อมชื่อ ----------
drop function if exists public.admin_create_user(text,text,text,jsonb,jsonb);
create or replace function public.admin_create_user(
  p_username text, p_password text,
  p_role text default 'user', p_tools jsonb default null, p_perms jsonb default null, p_name text default null)
returns uuid
language plpgsql security definer
set search_path = public, auth, extensions
as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := lower(trim(p_username));
begin
  if not public.is_admin() then raise exception 'ไม่มีสิทธิ์'; end if;
  if v_email = '' then raise exception 'กรุณากรอกรหัสพนักงาน'; end if;
  if position('@' in v_email) = 0 then v_email := v_email || '@ipone.co.th'; end if;
  if coalesce(length(p_password),0) < 6 then raise exception 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัว'; end if;
  if p_role not in ('admin','user') then raise exception 'role ไม่ถูกต้อง'; end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'รหัสพนักงานนี้มีอยู่แล้ว';
  end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, crypt(p_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now());

  insert into public.profiles (id, username, role, perms, tools, name)
  values (v_id, split_part(v_email,'@',1), p_role, p_perms, p_tools, nullif(trim(p_name),''))
  on conflict (id) do update
    set username = excluded.username, role = excluded.role,
        perms = excluded.perms, tools = excluded.tools, name = excluded.name;

  return v_id;
end $$;
revoke all on function public.admin_create_user(text,text,text,jsonb,jsonb,text) from public, anon;
grant execute on function public.admin_create_user(text,text,text,jsonb,jsonb,text) to authenticated;

-- ---------- 5) บัญชี: admin → รหัสพนักงาน 002548 · ลบ inven001 ----------
update auth.users set email = '002548@ipone.co.th', updated_at = now()
  where lower(email) = 'admin@ipone.co.th';
update auth.identities set identity_data = identity_data || jsonb_build_object('email','002548@ipone.co.th')
  where provider = 'email' and lower(identity_data->>'email') = 'admin@ipone.co.th';
update public.profiles set username = '002548' where username = 'admin';

delete from public.profiles where username = 'inven001';
delete from auth.users where lower(email) = 'inven001@ipone.co.th';

select username, role, name, tools from public.profiles order by username;
