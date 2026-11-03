-- Google reviews (Google search → Reviews in the editor): two more connection keys kept in Supabase Vault,
-- PLACES_KEY (a Google API key with Places API (New) turned on) and PLACE_ID (the business on Google Maps).
create or replace function public.site_secret_names() returns text[] language sql immutable as $$
  select array['GA_PROPERTY_ID', 'GA_SERVICE_ACCOUNT', 'GSC_SITE', 'PAGESPEED_KEY', 'PLACES_KEY', 'PLACE_ID'] $$;
