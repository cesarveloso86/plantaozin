ALTER TABLE public.profiles DROP COLUMN IF EXISTS matricula;
ALTER TABLE public.profiles RENAME COLUMN funcao TO cargo;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, nf, cargo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'nf', NULL),
    COALESCE(NEW.raw_user_meta_data ->> 'cargo', NULL)
  );
  RETURN NEW;
END;
$function$;