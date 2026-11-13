-- Bing (Website settings → Connections → Bing in the editor): one more connection key kept in Supabase Vault,
-- BING_KEY (the owner's Bing Webmaster API key, from Bing Webmaster → Settings → API access).
create or replace function public.site_secret_names() returns text[] language sql immutable as $$
  select array['GA_PROPERTY_ID', 'GA_SERVICE_ACCOUNT', 'GSC_SITE', 'PAGESPEED_KEY', 'PLACES_KEY', 'PLACE_ID', 'BING_KEY'] $$;
