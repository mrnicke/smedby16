-- Navigation routes are public metadata even when a page still uses its
-- checked-in static fallback. The view exposes no unpublished page content.
create view public.public_navigation_items as
select
  n.id,
  n.label,
  coalesce(n.external_url, p.slug) as href,
  n.sort_order
from public.navigation_items n
left join public.pages p on p.page_key = n.target_page_key
where n.visible
  and coalesce(n.external_url, p.slug) is not null;

revoke all on public.public_navigation_items from public;
grant select on public.public_navigation_items to anon, authenticated;
