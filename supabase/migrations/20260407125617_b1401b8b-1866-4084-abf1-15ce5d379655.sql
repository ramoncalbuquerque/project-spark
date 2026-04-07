
-- PASSO 1: Validation trigger for role values
CREATE OR REPLACE FUNCTION public.validate_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.role NOT IN ('master', 'leader', 'member') THEN
    RAISE EXCEPTION 'role must be master, leader, or member';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_profile_role_trigger
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_profile_role();

-- PASSO 2: Helper functions
CREATE OR REPLACE FUNCTION public.get_department_people(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
  WITH user_dept AS (
    SELECT department FROM public.profiles WHERE id = p_user_id
  )
  SELECT id FROM public.profiles
  WHERE department = (SELECT department FROM user_dept)
  AND department IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.can_view_card(p_card_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_role TEXT;
  v_created_by UUID;
  v_check BOOLEAN;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id;
  IF v_role = 'master' THEN RETURN TRUE; END IF;

  SELECT created_by INTO v_created_by FROM public.cards WHERE id = p_card_id;
  IF v_created_by = p_user_id THEN RETURN TRUE; END IF;

  SELECT EXISTS(SELECT 1 FROM public.card_assignees WHERE card_id = p_card_id AND profile_id = p_user_id) INTO v_check;
  IF v_check THEN RETURN TRUE; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.card_teams ct
    JOIN public.team_members tm ON tm.team_id = ct.team_id
    WHERE ct.card_id = p_card_id AND tm.profile_id = p_user_id
  ) INTO v_check;
  IF v_check THEN RETURN TRUE; END IF;

  IF v_role = 'leader' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.cards c
      WHERE c.id = p_card_id
      AND (
        c.created_by IN (SELECT public.get_department_people(p_user_id))
        OR EXISTS(
          SELECT 1 FROM public.card_assignees ca
          WHERE ca.card_id = p_card_id
          AND ca.profile_id IN (SELECT public.get_department_people(p_user_id))
        )
      )
    ) INTO v_check;
    IF v_check THEN RETURN TRUE; END IF;
  END IF;

  IF v_role = 'member' THEN
    IF (SELECT project_id FROM public.cards WHERE id = p_card_id) IS NOT NULL THEN
      SELECT EXISTS(
        SELECT 1 FROM public.project_members pm
        JOIN public.cards c ON c.project_id = pm.project_id
        WHERE c.id = p_card_id AND pm.profile_id = p_user_id
      ) INTO v_check;
      IF v_check THEN RETURN TRUE; END IF;
    END IF;

    IF (SELECT ritual_occurrence_id FROM public.cards WHERE id = p_card_id) IS NOT NULL THEN
      SELECT EXISTS(
        SELECT 1 FROM public.ritual_members rm
        JOIN public.ritual_occurrences ro ON ro.ritual_id = rm.ritual_id
        JOIN public.cards c ON c.ritual_occurrence_id = ro.id
        WHERE c.id = p_card_id AND rm.profile_id = p_user_id
      ) INTO v_check;
      IF v_check THEN RETURN TRUE; END IF;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$;

-- PASSO 3: Update cards RLS
DROP POLICY IF EXISTS "Users can view accessible cards" ON public.cards;
DROP POLICY IF EXISTS "Leaders can create cards" ON public.cards;
DROP POLICY IF EXISTS "Creator can update own cards" ON public.cards;
DROP POLICY IF EXISTS "Assignee can update card status" ON public.cards;
DROP POLICY IF EXISTS "Creator can delete cards" ON public.cards;

CREATE POLICY "cards_select_policy" ON public.cards
FOR SELECT TO authenticated
USING (public.can_view_card(id, auth.uid()));

CREATE POLICY "cards_insert_policy" ON public.cards
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "cards_update_policy" ON public.cards
FOR UPDATE TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'master'
  OR created_by = auth.uid()
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'leader'
    AND (
      created_by IN (SELECT public.get_department_people(auth.uid()))
      OR EXISTS(SELECT 1 FROM public.card_assignees WHERE card_id = id AND profile_id IN (SELECT public.get_department_people(auth.uid())))
    )
  )
  OR EXISTS(SELECT 1 FROM public.card_assignees WHERE card_id = id AND profile_id = auth.uid())
);

CREATE POLICY "cards_delete_policy" ON public.cards
FOR DELETE TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'master'
  OR created_by = auth.uid()
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'leader'
    AND created_by IN (SELECT public.get_department_people(auth.uid()))
  )
);

-- PASSO 4: Update projects RLS
DROP POLICY IF EXISTS "Members or creator can view projects" ON public.projects;
DROP POLICY IF EXISTS "Leaders can create projects" ON public.projects;

CREATE POLICY "projects_select" ON public.projects
FOR SELECT TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'master'
  OR created_by = auth.uid()
  OR EXISTS(SELECT 1 FROM public.project_members WHERE project_id = id AND profile_id = auth.uid())
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'leader'
    AND created_by IN (SELECT public.get_department_people(auth.uid()))
  )
);

CREATE POLICY "projects_insert" ON public.projects
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('master', 'leader')
);

-- Update rituals RLS
DROP POLICY IF EXISTS "Members or creator can view rituals" ON public.rituals;
DROP POLICY IF EXISTS "Leaders can create rituals" ON public.rituals;

CREATE POLICY "rituals_select" ON public.rituals
FOR SELECT TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'master'
  OR created_by = auth.uid()
  OR EXISTS(SELECT 1 FROM public.ritual_members WHERE ritual_id = id AND profile_id = auth.uid())
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'leader'
    AND created_by IN (SELECT public.get_department_people(auth.uid()))
  )
);

CREATE POLICY "rituals_insert" ON public.rituals
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('master', 'leader')
);
