-- Enrich team_members
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS nickname text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS lotacao text DEFAULT 'Central de Teleflagrante',
  ADD COLUMN IF NOT EXISTS equipe text;

-- Enrich profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nickname text,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS lotacao text DEFAULT 'Central de Teleflagrante',
  ADD COLUMN IF NOT EXISTS equipe text,
  ADD COLUMN IF NOT EXISTS signature_style jsonb NOT NULL DEFAULT '{}'::jsonb;