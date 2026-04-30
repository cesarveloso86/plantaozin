ALTER TABLE public.shift_occurrences DROP CONSTRAINT IF EXISTS shift_occurrences_status_check;
ALTER TABLE public.shift_occurrences ADD CONSTRAINT shift_occurrences_status_check
  CHECK (status IN ('em_atendimento', 'atendida', 'sem_oitiva'));