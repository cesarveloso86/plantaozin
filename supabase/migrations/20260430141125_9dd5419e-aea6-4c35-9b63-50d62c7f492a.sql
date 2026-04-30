-- Allow users to update their own analyses (needed to set pdf_storage_path
-- right after upload — fixes "PDF expirado" in Meu Histórico).
CREATE POLICY "Users can update own analyses"
ON public.analyses
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Ensure shift_occurrences emits full payloads via realtime.
ALTER TABLE public.shift_occurrences REPLICA IDENTITY FULL;