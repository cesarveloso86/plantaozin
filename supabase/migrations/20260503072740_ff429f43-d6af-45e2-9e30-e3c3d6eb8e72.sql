ALTER TABLE public.shift_occurrences
  ADD COLUMN has_fianca boolean NOT NULL DEFAULT false,
  ADD COLUMN fianca_paga boolean NOT NULL DEFAULT false;