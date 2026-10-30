-- ============================================================
-- IP One Tools Portal — ตั้งค่าครั้งเดียวใน Supabase SQL Editor
-- เพิ่มสิทธิ์รายเครื่องมือ + ฟังก์ชันจัดการผู้ใช้สำหรับ Admin
-- รันซ้ำได้ (ไม่ลบข้อมูลเดิม)
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- สิทธิ์เข้าเครื่องมือ: null = ทุกเครื่องมือ, หรือ ["audit","stock","assetsync"]
alter table public.profiles add column if not exists tools jsonb;

-- ---------- สร้างผู้ใช้ (Admin เท่านั้น) ----------
create or replace function public.admin_create_user(
  p_username text, p_password text,
  p_role text default 'user', p_tools jsonb default null, p_perms jsonb default null)
returns uuid
language plpgsql security definer
set search_path = public, auth, extensions
as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := lower(trim(p_username));
begin
  if not public.is_admin() then raise exception 'ไม่มีสิทธิ์'; end if;
  if v_email = '' then raise exception 'กรุณากรอก Username'; end if;
  if position('@' in v_email) = 0 then v_email := v_email || '@ipone.co.th'; end if;
  if coalesce(length(p_password),0) < 6 then raise exception 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัว'; end if;
  if p_role not in ('admin','user') then raise exception 'role ไม่ถูกต้อง'; end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'Username นี้มีอยู่แล้ว';
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

  insert into public.profiles (id, username, role, perms, tools)
  values (v_id, split_part(v_email,'@',1), p_role, p_perms, p_tools)
  on conflict (id) do update
    set username = excluded.username, role = excluded.role,
        perms = excluded.perms, tools = excluded.tools;

  return v_id;
end $$;

-- ---------- ตั้งรหัสผ่านใหม่ให้ผู้ใช้ (Admin เท่านั้น) ----------
create or replace function public.admin_set_password(p_user uuid, p_password text)
returns void
language plpgsql security definer
set search_path = public, auth, extensions
as $$
begin
  if not public.is_admin() then raise exception 'ไม่มีสิทธิ์'; end if;
  if coalesce(length(p_password),0) < 6 then raise exception 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัว'; end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now()
  where id = p_user;
  if not found then raise exception 'ไม่พบผู้ใช้'; end if;
end $$;

-- ---------- ลบผู้ใช้ (Admin เท่านั้น, ลบตัวเองไม่ได้) ----------
create or replace function public.admin_delete_user(p_user uuid)
returns void
language plpgsql security definer
set search_path = public, auth, extensions
as $$
begin
  if not public.is_admin() then raise exception 'ไม่มีสิทธิ์'; end if;
  if p_user = auth.uid() then raise exception 'ลบบัญชีตัวเองไม่ได้'; end if;
  delete from public.profiles where id = p_user;
  delete from auth.users where id = p_user;
end $$;

revoke all on function public.admin_create_user(text,text,text,jsonb,jsonb) from public, anon;
revoke all on function public.admin_set_password(uuid,text) from public, anon;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_create_user(text,text,text,jsonb,jsonb) to authenticated;
grant execute on function public.admin_set_password(uuid,text) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;

select 'portal setup ok' as result;
