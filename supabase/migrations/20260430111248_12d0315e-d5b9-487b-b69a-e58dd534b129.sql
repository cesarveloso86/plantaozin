
CREATE POLICY "OIP/Autoridade can read linked analyses"
ON public.analyses
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.shift_occurrences so
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE so.analysis_id = analyses.id
      AND (so.investigator = p.full_name OR so.authority = p.full_name)
  )
);

CREATE POLICY "OIP/Autoridade can update linked analyses"
ON public.analyses
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.shift_occurrences so
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE so.analysis_id = analyses.id
      AND (so.investigator = p.full_name OR so.authority = p.full_name)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.shift_occurrences so
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE so.analysis_id = analyses.id
      AND (so.investigator = p.full_name OR so.authority = p.full_name)
  )
);
