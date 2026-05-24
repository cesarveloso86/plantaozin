CREATE SCHEMA IF NOT EXISTS app_private;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated;
REVOKE ALL ON FUNCTION app_private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated;

DROP POLICY IF EXISTS "Admins can read all analyses" ON public.analyses;
CREATE POLICY "Admins can read all analyses" ON public.analyses
FOR SELECT TO authenticated
USING (app_private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles" ON public.profiles
FOR SELECT TO authenticated
USING (app_private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles
FOR UPDATE TO authenticated
USING (app_private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (app_private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Creator or admin can delete occurrences" ON public.shift_occurrences;
CREATE POLICY "Creator or admin can delete occurrences" ON public.shift_occurrences
FOR DELETE TO authenticated
USING ((auth.uid() = created_by) OR app_private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Creator or admin can update occurrences" ON public.shift_occurrences;
CREATE POLICY "Creator or admin can update occurrences" ON public.shift_occurrences
FOR UPDATE TO authenticated
USING ((auth.uid() = created_by) OR app_private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK ((auth.uid() = created_by) OR app_private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Creator or admin can delete shifts" ON public.shifts;
CREATE POLICY "Creator or admin can delete shifts" ON public.shifts
FOR DELETE TO authenticated
USING ((auth.uid() = created_by) OR app_private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Creator or admin can update shifts" ON public.shifts;
CREATE POLICY "Creator or admin can update shifts" ON public.shifts
FOR UPDATE TO authenticated
USING ((auth.uid() = created_by) OR app_private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK ((auth.uid() = created_by) OR app_private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can manage team_members" ON public.team_members;
CREATE POLICY "Admins can manage team_members" ON public.team_members
FOR ALL TO authenticated
USING (app_private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (app_private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles" ON public.user_roles
FOR DELETE TO authenticated
USING (app_private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (app_private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;
CREATE POLICY "Admins can read all roles" ON public.user_roles
FOR SELECT TO authenticated
USING (app_private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles" ON public.user_roles
FOR UPDATE TO authenticated
USING (app_private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (app_private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage bo-pdfs" ON storage.objects;
CREATE POLICY "Admins manage bo-pdfs" ON storage.objects
FOR ALL TO authenticated
USING ((bucket_id = 'bo-pdfs'::text) AND app_private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK ((bucket_id = 'bo-pdfs'::text) AND app_private.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;