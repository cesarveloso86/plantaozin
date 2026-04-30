
CREATE POLICY "OIP/Autoridade can read linked PDFs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'bo-pdfs'
  AND EXISTS (
    SELECT 1
    FROM public.analyses a
    JOIN public.shift_occurrences so ON so.analysis_id = a.id
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE a.pdf_storage_path = storage.objects.name
      AND (so.investigator = p.full_name OR so.authority = p.full_name)
  )
);

CREATE POLICY "OIP/Autoridade can delete linked PDFs after generation"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'bo-pdfs'
  AND EXISTS (
    SELECT 1
    FROM public.analyses a
    JOIN public.shift_occurrences so ON so.analysis_id = a.id
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE a.pdf_storage_path = storage.objects.name
      AND (so.investigator = p.full_name OR so.authority = p.full_name)
  )
);
