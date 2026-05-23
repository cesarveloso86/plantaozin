-- 1) PROFILES: restrict base-table SELECT to owner & admin; expose safe fields via public view.
DROP POLICY IF EXISTS "All authenticated can read profiles" ON public.profiles;

-- Prevent privilege escalation via profiles.role on insert (force 'analista').
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id AND role = 'analista');

-- Block non-admin self-update of role (keep other field updates).
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

-- Public-safe view (only non-sensitive columns).
CREATE OR REPLACE VIEW public.profiles_public AS
  SELECT id, full_name, nickname, avatar_url, role, equipe, lotacao
  FROM public.profiles;

REVOKE ALL ON public.profiles_public FROM PUBLIC;
GRANT SELECT ON public.profiles_public TO authenticated;

-- 2) TEAM_MEMBERS: restrict base table to admins; expose safe fields via public view.
DROP POLICY IF EXISTS "Authenticated users can read team_members" ON public.team_members;

CREATE OR REPLACE VIEW public.team_members_public AS
  SELECT id, full_name, nickname, cargo, equipe, lotacao, is_active
  FROM public.team_members;

REVOKE ALL ON public.team_members_public FROM PUBLIC;
GRANT SELECT ON public.team_members_public TO authenticated;

-- 3) has_role(): revoke EXECUTE from public/anon/authenticated.
-- RLS policies that reference has_role() continue to work because policy
-- evaluation uses the function regardless of caller EXECUTE privilege.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;