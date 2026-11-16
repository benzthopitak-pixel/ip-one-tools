-- Security hardening (applied to Supabase project IPone-audit on 16/11/2026) · run again any time, it is safe to repeat

-- 1) Self sign-ups can never choose their role and get no tools (admin_create_user sets the real values itself)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into public.profiles (id, username, role, tools)
  values (new.id, split_part(new.email, '@', 1), 'user', '[]'::jsonb)
  on conflict (id) do nothing;
  return new;
end $function$;

-- 2) fixed search_path
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path to 'public' as $function$
begin new.updated_at = now(); return new; end $function$;

-- 3) trigger-only functions are not callable through the API; admin RPCs never for signed-out visitors
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.admin_create_user(text, text, text, jsonb, jsonb, text) from public, anon;
revoke execute on function public.admin_set_password(uuid, text) from public, anon;
revoke execute on function public.admin_delete_user(uuid) from public, anon;
