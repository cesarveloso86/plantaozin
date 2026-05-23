-- Replace SECURITY DEFINER views with SECURITY DEFINER RPC functions (scoped to authenticated)
DROP VIEW IF EXISTS public.profiles_public;
DROP VIEW IF EXISTS public.team_members_public;

CREATE OR REPLACE FUNCTION public.list_safe_profiles()
RETURNS TABLE (
  id uuid,
  full_name text,
  nickname text,
  avatar_url text,
  role text,
  equipe text,
  lotacao text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, full_name, nickname, avatar_url, role, equipe, lotacao
  FROM public.profiles
  WHERE auth.uid() IS NOT NULL
  ORDER BY full_name;
$$;

REVOKE EXECUTE ON FUNCTION public.list_safe_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_safe_profiles() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_safe_team_members()
RETURNS TABLE (
  id uuid,
  full_name text,
  nickname text,
  cargo text,
  equipe text,
  lotacao text,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, full_name, nickname, cargo, equipe, lotacao, is_active
  FROM public.team_members
  WHERE auth.uid() IS NOT NULL
  ORDER BY full_name;
$$;

REVOKE EXECUTE ON FUNCTION public.list_safe_team_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_safe_team_members() TO authenticated;

-- Lock down trigger-only functions (they keep working because triggers run as the function owner).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;