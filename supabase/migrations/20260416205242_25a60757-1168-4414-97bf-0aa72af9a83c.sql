ALTER TABLE public.shift_occurrences ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'em_atendimento';
UPDATE public.shift_occurrences SET status = 'atendida' WHERE status = 'em_atendimento';
ALTER TABLE public.shift_occurrences ALTER COLUMN status SET DEFAULT 'em_atendimento';
ALTER TABLE public.shift_occurrences ADD CONSTRAINT shift_occurrences_status_check CHECK (status IN ('em_atendimento','atendida'));