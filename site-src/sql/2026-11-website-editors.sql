-- Website editor: invite other people (Website settings → Editors).
-- The owner (ADMIN_EMAILS in Vercel, an active admin in portal_users) invites someone by email with a level:
--   editor = the website's wording, pages, photos and settings (not Leads, Stats, Visitors, SEO, Connections or Editors)
--   writer = pages and news only
-- The editor makes a private one-time link (#invite=<token>, valid 7 days) that the owner sends themselves; the person
-- opens it, chooses a password and their sign-in is made here (no email from Supabase, whose built-in mailer only
-- reaches the project's own team). Only a fingerprint (sha256) of the link is stored.

create table if not exists public.website_editors (
  email text primary key,
  name text not null default '',
  role text not null default 'editor' check (role in ('editor', 'writer')),
  invited_by text,
  invited_at timestamptz not null default now(),
  token_hash text,
  token_expires timestamptz,
  accepted_at timestamptz,
  last_seen timestamptz
);
alter table public.website_editors enable row level security;   -- no policies: only the functions below reach it
revoke all on table public.website_editors from anon, authenticated;

-- owner: make (or remake) an invite link; returns the token for the link
create or replace function public.website_editor_invite(p_email text, p_name text, p_role text)
returns text language plpgsql volatile security definer set search_path to 'public', 'extensions' as $$
declare e text := lower(trim(coalesce(p_email, ''))); t text;
begin
  if not public.chat_is_admin() then raise exception 'not allowed'; end if;
  if e !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'That email address doesn''t look right.'; end if;
  if p_role not in ('editor', 'writer') then raise exception 'Unknown level.'; end if;
  if exists (select 1 from public.portal_users u where lower(u.email) = e and u.role = 'admin' and u.active) then
    raise exception 'That person is already an owner and can sign in already.'; end if;
  t := encode(gen_random_bytes(24), 'hex');
  insert into public.website_editors (email, name, role, invited_by, invited_at, token_hash, token_expires)
  values (e, left(trim(coalesce(p_name, '')), 80), p_role, auth.jwt() ->> 'email', now(), encode(digest(t, 'sha256'), 'hex'), now() + interval '7 days')
  on conflict (email) do update set name = excluded.name, role = excluded.role, invited_by = excluded.invited_by,
    invited_at = now(), token_hash = excluded.token_hash, token_expires = excluded.token_expires;
  return t;
end $$;

-- owner: everyone invited
create or replace function public.website_editors_list()
returns table(email text, name text, role text, invited_by text, invited_at timestamptz, link_expires timestamptz, accepted_at timestamptz, last_seen timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.chat_is_admin() then raise exception 'not allowed'; end if;
  return query select w.email, w.name, w.role, w.invited_by, w.invited_at, case when w.token_hash is null then null else w.token_expires end, w.accepted_at, w.last_seen
    from public.website_editors w order by w.invited_at desc;
end $$;

-- owner: change someone's level
create or replace function public.website_editor_set_role(p_email text, p_role text)
returns void language plpgsql volatile security definer set search_path to 'public' as $$
begin
  if not public.chat_is_admin() then raise exception 'not allowed'; end if;
  if p_role not in ('editor', 'writer') then raise exception 'Unknown level.'; end if;
  update public.website_editors set role = p_role where email = lower(trim(p_email));
end $$;

-- owner: take someone's access away (their sign-in is removed too, unless it belongs to a portal admin)
create or replace function public.website_editor_remove(p_email text)
returns void language plpgsql volatile security definer set search_path to 'public' as $$
declare e text := lower(trim(coalesce(p_email, '')));
begin
  if not public.chat_is_admin() then raise exception 'not allowed'; end if;
  delete from public.website_editors where email = e;
  if not exists (select 1 from public.portal_users u where lower(u.email) = e) then
    delete from auth.users where lower(email) = e;
  end if;
end $$;

-- signed in: the caller's level, or null if they weren't invited (the editor's server asks this on each request)
create or replace function public.website_editor_ok()
returns text language plpgsql volatile security definer set search_path to 'public' as $$
declare e text := lower(coalesce(auth.jwt() ->> 'email', '')); r text;
begin
  select w.role into r from public.website_editors w where w.email = e and w.accepted_at is not null;
  if r is not null then update public.website_editors set last_seen = now() where email = e and (last_seen is null or last_seen < now() - interval '5 minutes'); end if;
  return r;
end $$;

-- anyone with the link: who it's for (to show on the welcome screen)
create or replace function public.website_invite_info(p_token text)
returns table(email text, name text, role text, invited_by text, has_account boolean, expired boolean)
language plpgsql stable security definer set search_path to 'public', 'extensions' as $$
begin
  return query select w.email, w.name, w.role, w.invited_by, exists (select 1 from auth.users u where lower(u.email) = w.email), w.token_expires < now()
    from public.website_editors w where w.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
end $$;

-- anyone with the link: choose a password; the sign-in is made (or its password set) and the link stops working
create or replace function public.website_invite_accept(p_token text, p_password text)
returns text language plpgsql volatile security definer set search_path to 'public', 'extensions' as $$
declare w public.website_editors; uid uuid;
begin
  select * into w from public.website_editors where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if w.email is null then raise exception 'This invite link has already been used or was replaced by a newer one.'; end if;
  if w.token_expires < now() then raise exception 'This invite link has expired. Ask for a new one.'; end if;
  if length(coalesce(p_password, '')) < 10 then raise exception 'Use at least 10 characters.'; end if;
  select id into uid from auth.users where lower(email) = w.email limit 1;
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', w.email, crypt(p_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('name', w.name), now(), now(), '', '', '', '', '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', w.email, 'email_verified', true), 'email', now(), now(), now());
  else
    update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = uid;
  end if;
  update public.website_editors set accepted_at = now(), token_hash = null, token_expires = null where email = w.email;
  return w.email;
end $$;

revoke all on function public.website_editor_invite(text, text, text), public.website_editors_list(), public.website_editor_set_role(text, text),
  public.website_editor_remove(text), public.website_editor_ok(), public.website_invite_info(text), public.website_invite_accept(text, text) from public, anon;
grant execute on function public.website_editor_invite(text, text, text), public.website_editors_list(), public.website_editor_set_role(text, text),
  public.website_editor_remove(text), public.website_editor_ok() to authenticated;
grant execute on function public.website_invite_info(text), public.website_invite_accept(text, text) to anon, authenticated;
