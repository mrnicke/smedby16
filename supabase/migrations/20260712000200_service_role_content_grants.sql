-- Edge Functions use service_role after authenticating and authorizing the caller.
-- RLS bypass alone does not grant table privileges.
grant select, insert, update, delete on table
  public.admin_profiles,
  public.pages,
  public.news_posts,
  public.calendar_events,
  public.documents,
  public.media_assets,
  public.navigation_items,
  public.site_settings,
  public.content_revisions,
  public.snapshot_deployments
to service_role;
