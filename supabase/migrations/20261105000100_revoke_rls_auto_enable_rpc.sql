-- rls_auto_enable() is the event trigger that turns RLS on for every new public table.
-- It never needs to be callable over the REST API (/rest/v1/rpc), so take EXECUTE away from API roles.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
