CREATE OR REPLACE FUNCTION public.get_departments()
RETURNS SETOF TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT department FROM public.profiles
  WHERE department IS NOT NULL
  ORDER BY department;
$$;

GRANT EXECUTE ON FUNCTION public.get_departments() TO anon, authenticated;