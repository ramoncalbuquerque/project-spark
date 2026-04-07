CREATE OR REPLACE FUNCTION public.get_departments()
RETURNS SETOF TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT department FROM (
    SELECT department FROM public.profiles WHERE department IS NOT NULL
    UNION
    SELECT department FROM public.contacts WHERE department IS NOT NULL
  ) sub
  ORDER BY department;
$$;