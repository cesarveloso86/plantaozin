
CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  team_name text NOT NULL,
  shift_date date NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  status text NOT NULL DEFAULT 'active',
  authorities jsonb NOT NULL DEFAULT '[]',
  investigators jsonb NOT NULL DEFAULT '[]',
  iseo jsonb NOT NULL DEFAULT '[]',
  observations text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all shifts" ON public.shifts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert shifts" ON public.shifts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator or admin can update shifts" ON public.shifts
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Creator or admin can delete shifts" ON public.shifts
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

CREATE TABLE public.shift_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  bu_number text NOT NULL,
  tramitation_time timestamptz,
  procedure_type text,
  procedure_type_2 text,
  procedure_type_3 text,
  investigator text,
  authority text,
  regional text,
  has_report boolean NOT NULL DEFAULT false,
  num_hearings integer NOT NULL DEFAULT 0,
  final_time timestamptz,
  first_hearing_time timestamptz,
  observations text,
  conducted_names text,
  victim_names text,
  suspect_names text,
  tipification text,
  po_status text,
  analysis_id uuid REFERENCES public.analyses(id),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shift_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read shift occurrences" ON public.shift_occurrences
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert occurrences" ON public.shift_occurrences
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator or admin can update occurrences" ON public.shift_occurrences
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Creator or admin can delete occurrences" ON public.shift_occurrences
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_occurrences;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shifts;
