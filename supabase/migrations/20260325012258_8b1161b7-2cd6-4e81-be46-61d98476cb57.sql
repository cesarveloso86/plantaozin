CREATE POLICY "All authenticated can read profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);