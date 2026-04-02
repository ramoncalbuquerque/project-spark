
-- 1. Create security definer functions
CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id AND profile_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_creator(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams
    WHERE id = p_team_id AND created_by = p_user_id
  );
$$;

-- 2. Secure the functions
REVOKE EXECUTE ON FUNCTION public.is_team_member FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_team_member TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_team_creator FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_team_creator TO authenticated;

-- 3. Fix teams SELECT policy (was referencing team_members directly)
DROP POLICY IF EXISTS "Members and creator can view team" ON public.teams;
CREATE POLICY "Members and creator can view team" ON public.teams
FOR SELECT TO authenticated
USING (created_by = auth.uid() OR public.is_team_member(id, auth.uid()));

-- 4. Fix team_members SELECT policy (was referencing teams directly)
DROP POLICY IF EXISTS "Members and team creator can view team_members" ON public.team_members;
CREATE POLICY "Members and team creator can view team_members" ON public.team_members
FOR SELECT TO authenticated
USING (profile_id = auth.uid() OR public.is_team_creator(team_id, auth.uid()));

-- 5. Fix team_members INSERT policy
DROP POLICY IF EXISTS "Team creator can add members" ON public.team_members;
CREATE POLICY "Team creator can add members" ON public.team_members
FOR INSERT TO authenticated
WITH CHECK (public.is_team_creator(team_id, auth.uid()));

-- 6. Fix team_members DELETE policy
DROP POLICY IF EXISTS "Team creator can remove members" ON public.team_members;
CREATE POLICY "Team creator can remove members" ON public.team_members
FOR DELETE TO authenticated
USING (public.is_team_creator(team_id, auth.uid()));

-- 7. Fix cards SELECT policy (was referencing team_members directly)
DROP POLICY IF EXISTS "Users can view accessible cards" ON public.cards;
CREATE POLICY "Users can view accessible cards" ON public.cards
FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR assigned_to_profile = auth.uid()
  OR public.is_team_member(assigned_to_team, auth.uid())
);
