CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), ''),
    'member'
  );

  -- Link contacts with matching phone
  IF NEW.raw_user_meta_data->>'phone' IS NOT NULL AND TRIM(NEW.raw_user_meta_data->>'phone') <> '' THEN
    UPDATE public.contacts
    SET linked_profile_id = NEW.id
    WHERE phone = TRIM(NEW.raw_user_meta_data->>'phone')
      AND linked_profile_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;