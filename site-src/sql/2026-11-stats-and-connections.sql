-- Website editor: Stats (leads and chat questions for any period) and Connections (keys kept in Supabase Vault).
-- Every function checks the caller is an active portal admin (chat_is_admin()), like the chat helper's functions.

-- Leads that came from the website (portal_records "leads", source = website; deleted ones left out). leads = people
-- (a repeat send merged into an earlier lead isn't counted again), sends = every form sent, repeats included.
-- and chat questions, between p_from and p_to. Days and hours are New Zealand time.
create or replace function public.website_stats(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare res jsonb;
begin
  if not public.chat_is_admin() then raise exception 'not allowed'; end if;
  with l as (
    select id, data, (data->>'createdAt')::timestamptz as at, coalesce(data->>'mergedInto', '') <> '' as is_repeat
    from public.portal_records
    where collection = 'leads' and data->>'source' = 'website'
      and coalesce(data->>'deleted', 'false') <> 'true'
      and data->>'createdAt' ~ '^\d{4}-\d{2}-\d{2}T'
  ), w as (
    select *, case
        when coalesce(data->'extra'->>'form', '') <> '' then data->'extra'->>'form'
        when coalesce(data->>'page', '') = '' then 'Website form'
        when regexp_replace(split_part(data->>'page', '?', 1), '^https?://[^/]+', '') in ('', '/') then 'Homepage form'
        else 'Form on ' || regexp_replace(split_part(data->>'page', '?', 1), '^https?://[^/]+', '') end as form
    from l where at >= p_from and at < p_to
  ), w1 as (select * from w where not is_repeat
  ), c as (
    select * from public.chat_questions where at >= p_from and at < p_to
  )
  select jsonb_build_object(
    'leads', (select count(*) from w1),
    'sends', (select count(*) from w),
    'by_day', coalesce((select jsonb_agg(jsonb_build_object('d', d, 'n', n) order by d) from (select to_char(at at time zone 'Pacific/Auckland', 'YYYY-MM-DD') d, count(*) n from w1 group by 1) x), '[]'::jsonb),
    'by_hour', coalesce((select jsonb_agg(jsonb_build_object('h', h, 'n', n) order by h) from (select to_char(at at time zone 'Pacific/Auckland', 'YYYY-MM-DD"T"HH24') h, count(*) n from w1 group by 1) x), '[]'::jsonb),
    'forms', coalesce((select jsonb_agg(jsonb_build_object('name', form, 'n', n) order by n desc) from (select form, count(*) n from w group by 1) x), '[]'::jsonb),
    'latest', coalesce((select jsonb_agg(x order by x->>'at' desc) from (select jsonb_build_object('id', id, 'name', coalesce(nullif(data->>'name', ''), nullif(data->>'company', ''), 'Someone'), 'service', coalesce(data->>'service', ''), 'form', form, 'at', data->>'createdAt', 'status', coalesce(data->>'status', '')) x from w1 order by at desc limit 8) y), '[]'::jsonb),
    'chat', jsonb_build_object('asked', (select count(*) from c), 'unanswered', (select count(*) from c where result in ('not found', 'off topic') and not coalesce(done, false)))
  ) into res;
  return res;
end $$;

-- Connection keys for the website (Google Analytics reporting, Search Console, PageSpeed), kept encrypted in Supabase Vault
-- as "site:<NAME>". A key saved here is used before the Vercel environment variable of the same name.
create or replace function public.site_secret_names() returns text[] language sql immutable as $$
  select array['GA_PROPERTY_ID', 'GA_SERVICE_ACCOUNT', 'GSC_SITE', 'PAGESPEED_KEY'] $$;

create or replace function public.site_secret_set(p_name text, p_value text)
returns void language plpgsql volatile security definer set search_path to 'public', 'vault' as $$
declare sid uuid; who text := coalesce(auth.jwt() ->> 'email', '');
begin
  if not public.chat_is_admin() then raise exception 'not allowed'; end if;
  if not (p_name = any (public.site_secret_names())) then raise exception 'unknown connection'; end if;
  select id into sid from vault.secrets where name = 'site:' || p_name;
  if coalesce(p_value, '') = '' then
    if sid is not null then delete from vault.secrets where id = sid; end if;
    return;
  end if;
  if sid is null then perform vault.create_secret(p_value, 'site:' || p_name, 'by ' || who);
  else perform vault.update_secret(sid, p_value, 'site:' || p_name, 'by ' || who); end if;
end $$;

-- What is saved, never the keys: the last 4 characters of a key, the plain value of the property number and site
create or replace function public.site_secret_status()
returns table(name text, hint text, note text, updated_at timestamptz)
language plpgsql stable security definer set search_path to 'public', 'vault' as $$
begin
  if not public.chat_is_admin() then raise exception 'not allowed'; end if;
  return query select substr(d.name, 6), case when substr(d.name, 6) in ('GA_PROPERTY_ID', 'GSC_SITE') then d.decrypted_secret
      when substr(d.name, 6) = 'GA_SERVICE_ACCOUNT' then coalesce((d.decrypted_secret::jsonb ->> 'client_email'), '••••')
      else '••••' || right(d.decrypted_secret, 4) end, d.description, d.updated_at
    from vault.decrypted_secrets d where d.name like 'site:%';
end $$;

-- The keys themselves, for the editor's server code (signed in as an admin)
create or replace function public.site_secret_get()
returns table(name text, value text)
language plpgsql stable security definer set search_path to 'public', 'vault' as $$
begin
  if not public.chat_is_admin() then raise exception 'not allowed'; end if;
  return query select substr(d.name, 6), d.decrypted_secret from vault.decrypted_secrets d where d.name like 'site:%';
end $$;

revoke all on function public.website_stats(timestamptz, timestamptz), public.site_secret_set(text, text), public.site_secret_status(), public.site_secret_get() from public, anon;
grant execute on function public.website_stats(timestamptz, timestamptz), public.site_secret_set(text, text), public.site_secret_status(), public.site_secret_get() to authenticated;
