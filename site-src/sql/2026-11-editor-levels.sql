-- Website editor: the owner chooses which parts of the editor each level (Editor, Writer) can see and use
-- (Website settings → Editors → Levels). Parts are the editor's menu items; Connections and Editors stay owner-only.
-- Builds on 2026-11-website-editors.sql.

create table if not exists public.website_levels (
  role text primary key check (role in ('editor', 'writer')),
  areas text[] not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.website_levels enable row level security;   -- no policies: only the functions below reach it
revoke all on table public.website_levels from anon, authenticated;
insert into public.website_levels (role, areas) values
  ('editor', array['wording','pages','design','sections','menus','redirects','photos','business','chat','calc','health','history','signature']),
  ('writer', array['pages','photos','health','history'])
on conflict (role) do nothing;

-- the parts that can be given to a level
create or replace function public.website_level_parts() returns text[] language sql immutable as $$
  select array['wording','pages','design','sections','menus','redirects','photos','business','chat','calc','health','history','signature','stats','leads','visitors','seo'] $$;

-- signed in: the caller's level and its parts (null if not invited); the editor's server asks this on each request
create or replace function public.website_editor_access()
returns jsonb language plpgsql volatile security definer set search_path to 'public' as $$
declare e text := lower(coalesce(auth.jwt() ->> 'email', '')); r text; a text[];
begin
  select w.role into r from public.website_editors w where w.email = e and w.accepted_at is not null;
  if r is null then return null; end if;
  select l.areas into a from public.website_levels l where l.role = r;
  update public.website_editors set last_seen = now() where email = e and (last_seen is null or last_seen < now() - interval '5 minutes');
  return jsonb_build_object('role', r, 'areas', coalesce(a, '{}'));
end $$;

-- does the signed-in invited person's level include this part?
create or replace function public.website_editor_can(p_area text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.website_editors w join public.website_levels l on l.role = w.role
    where w.email = lower(coalesce(auth.jwt() ->> 'email', '')) and w.accepted_at is not null and p_area = any(l.areas)) $$;

-- owner: every level's parts
create or replace function public.website_levels_list()
returns table(role text, areas text[], updated_at timestamptz, updated_by text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.chat_is_admin() then raise exception 'not allowed'; end if;
  return query select l.role, l.areas, l.updated_at, l.updated_by from public.website_levels l order by l.role;
end $$;

-- owner: choose a level's parts
create or replace function public.website_level_set(p_role text, p_areas text[])
returns void language plpgsql volatile security definer set search_path to 'public' as $$
begin
  if not public.chat_is_admin() then raise exception 'not allowed'; end if;
  if p_role not in ('editor', 'writer') then raise exception 'Unknown level.'; end if;
  if exists (select 1 from unnest(coalesce(p_areas, '{}')) x where x <> all(public.website_level_parts())) then raise exception 'Unknown part.'; end if;
  update public.website_levels set areas = (select coalesce(array_agg(distinct x), '{}') from unnest(coalesce(p_areas, '{}')) x), updated_at = now(), updated_by = auth.jwt() ->> 'email' where role = p_role;
end $$;

-- The connection keys for the editor's server when an invited person uses Visitors, Stats or Google search.
-- Only the server can get them: it proves itself with a fingerprint of its own GitHub key (set by the owner's sessions,
-- site_server_proof_set), which the browser never has. Invited people can't call site_secret_get themselves.
create table if not exists public.website_server (id int primary key default 1 check (id = 1), proof_hash text, updated_at timestamptz);
alter table public.website_server enable row level security;
revoke all on table public.website_server from anon, authenticated;

create or replace function public.site_server_proof_set(p_hash text)
returns void language plpgsql volatile security definer set search_path to 'public' as $$
begin
  if not public.chat_is_admin() then raise exception 'not allowed'; end if;
  if coalesce(p_hash, '') !~ '^[0-9a-f]{64}$' then raise exception 'bad proof'; end if;
  insert into public.website_server (id, proof_hash, updated_at) values (1, p_hash, now())
  on conflict (id) do update set proof_hash = excluded.proof_hash, updated_at = now() where website_server.proof_hash is distinct from excluded.proof_hash;
end $$;

create or replace function public.site_secret_get_server(p_proof text, p_area text)
returns table(name text, value text) language plpgsql stable security definer set search_path to 'public', 'vault', 'extensions' as $$
begin
  if not public.website_editor_can(p_area) or p_area not in ('stats', 'visitors', 'seo', 'health') then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.website_server s where s.proof_hash = encode(digest(coalesce(p_proof, ''), 'sha256'), 'hex')) then raise exception 'not allowed'; end if;
  return query select substr(d.name, 6), d.decrypted_secret from vault.decrypted_secrets d where d.name like 'site:%';
end $$;

revoke all on function public.website_editor_access(), public.website_editor_can(text), public.website_levels_list(), public.website_level_set(text, text[]),
  public.site_server_proof_set(text), public.site_secret_get_server(text, text) from public, anon;
grant execute on function public.website_editor_access(), public.website_editor_can(text), public.website_levels_list(), public.website_level_set(text, text[]),
  public.site_server_proof_set(text), public.site_secret_get_server(text, text) to authenticated;
grant execute on function public.website_level_parts() to authenticated;

-- Leads, Stats and the chat question log: also open to an invited person whose level includes that part
do $$
declare f record; d text; area text;
begin
  for f in select p.oid, p.proname from pg_proc p join pg_namespace s on s.oid = p.pronamespace
    where s.nspname = 'public' and p.proname in ('website_stats', 'website_leads', 'chat_questions_list', 'chat_questions_mark', 'chat_questions_note', 'chat_questions_update') loop
    area := case f.proname when 'website_stats' then 'stats' when 'website_leads' then 'leads' else 'chat' end;
    d := pg_get_functiondef(f.oid);
    if position('website_editor_can' in d) = 0 then
      d := regexp_replace(d, '(public\.)?chat_is_admin\(\)', '(public.chat_is_admin() or public.website_editor_can(''' || area || '''))');
      execute d;
    end if;
  end loop;
end $$;

-- Google search (SEO) → On Google: when someone pressed "Request indexing" for a page (Google doesn't report it back),
-- shared across devices. Open to the owner and to a level that includes Google search (seo).
create table if not exists public.website_index_requests (url text primary key, requested_at timestamptz not null default now(), requested_by text);
alter table public.website_index_requests enable row level security;
revoke all on table public.website_index_requests from anon, authenticated;
create or replace function public.website_index_requests_list()
returns table(url text, requested_at timestamptz, requested_by text) language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not (public.chat_is_admin() or public.website_editor_can('seo')) then raise exception 'not allowed'; end if;
  return query select r.url, r.requested_at, r.requested_by from public.website_index_requests r;
end $$;
create or replace function public.website_index_request_mark(p_url text, p_clear boolean default false)
returns void language plpgsql volatile security definer set search_path to 'public' as $$
begin
  if not (public.chat_is_admin() or public.website_editor_can('seo')) then raise exception 'not allowed'; end if;
  if coalesce(p_url, '') !~ '^https://ambs\.co\.nz(/[^\s]*)?$' then raise exception 'Only ambs.co.nz pages.'; end if;
  if p_clear then delete from public.website_index_requests where url = p_url; return; end if;
  insert into public.website_index_requests (url, requested_at, requested_by) values (p_url, now(), auth.jwt() ->> 'email')
  on conflict (url) do update set requested_at = now(), requested_by = excluded.requested_by;
end $$;
revoke all on function public.website_index_requests_list(), public.website_index_request_mark(text, boolean) from public, anon;
grant execute on function public.website_index_requests_list(), public.website_index_request_mark(text, boolean) to authenticated;
