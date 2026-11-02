-- Website editor → Insights → Leads: every enquiry sent from the website (portal_records "leads" with source "website",
-- deleted ones left out) between p_from and p_to, newest first, with what the person filled in. merged_into is set on a
-- repeat send that the portal merged into an earlier lead, so the editor can group them. Admin-only (chat_is_admin()).
create or replace function public.website_leads(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare res jsonb;
begin
  if not public.chat_is_admin() then raise exception 'not allowed'; end if;
  select coalesce(jsonb_agg(x order by x->>'at' desc), '[]'::jsonb) into res from (
    select jsonb_build_object(
      'id', id,
      'at', data->>'createdAt',
      'name', coalesce(data->>'name', ''),
      'email', coalesce(data->>'email', ''),
      'phone', coalesce(data->>'phone', ''),
      'company', coalesce(data->>'company', ''),
      'service', coalesce(data->>'service', ''),
      'message', left(coalesce(data->>'message', ''), 4000),
      'page', coalesce(data->>'page', ''),
      'form', case
        when coalesce(data->'extra'->>'form', '') <> '' then data->'extra'->>'form'
        when coalesce(data->>'page', '') = '' then 'Website form'
        when regexp_replace(split_part(data->>'page', '?', 1), '^https?://[^/]+', '') in ('', '/') then 'Homepage form'
        else 'Form on ' || regexp_replace(split_part(data->>'page', '?', 1), '^https?://[^/]+', '') end,
      'language', coalesce(data->'extra'->>'language', ''),
      'status', coalesce(data->>'status', ''),
      'archived', coalesce(data->>'archived', '') = 'true',
      'merged_into', coalesce(data->>'mergedInto', '')
    ) x
    from public.portal_records
    where collection = 'leads' and data->>'source' = 'website'
      and coalesce(data->>'deleted', 'false') <> 'true'
      and data->>'createdAt' ~ '^\d{4}-\d{2}-\d{2}T'
      and (data->>'createdAt')::timestamptz >= p_from and (data->>'createdAt')::timestamptz < p_to
    order by data->>'createdAt' desc
    limit 1000
  ) y;
  return res;
end $$;

revoke all on function public.website_leads(timestamptz, timestamptz) from public, anon;
grant execute on function public.website_leads(timestamptz, timestamptz) to authenticated;
