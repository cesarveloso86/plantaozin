-- Bucket privado para PDFs de BU (efêmeros)
INSERT INTO storage.buckets (id, name, public)
VALUES ('bo-pdfs', 'bo-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Usuários podem enviar PDFs em sua própria pasta (user_id/...)
CREATE POLICY "Users can upload own bo-pdfs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'bo-pdfs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Usuários podem ler seus próprios PDFs
CREATE POLICY "Users can read own bo-pdfs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'bo-pdfs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Usuários podem remover seus próprios PDFs
CREATE POLICY "Users can delete own bo-pdfs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'bo-pdfs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins têm acesso total ao bucket
CREATE POLICY "Admins manage bo-pdfs"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'bo-pdfs' AND has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  bucket_id = 'bo-pdfs' AND has_role(auth.uid(), 'admin'::app_role)
);

-- Coluna que aponta para o objeto no bucket (path: <user_id>/<analysis_id>.pdf)
ALTER TABLE public.analyses
ADD COLUMN IF NOT EXISTS pdf_storage_path text;