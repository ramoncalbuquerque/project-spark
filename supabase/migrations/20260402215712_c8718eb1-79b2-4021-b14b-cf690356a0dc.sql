
-- 1. Create new tables
CREATE TABLE IF NOT EXISTS public.card_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(card_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.card_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(card_id, team_id)
);

ALTER TABLE public.card_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_teams ENABLE ROW LEVEL SECURITY;

-- 2. Security definer functions
CREATE OR REPLACE FUNCTION public.is_card_assignee(p_card_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.card_assignees WHERE card_id = p_card_id AND profile_id = p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_card_team_member(p_card_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.card_teams ct
    JOIN public.team_members tm ON tm.team_id = ct.team_id
    WHERE ct.card_id = p_card_id AND tm.profile_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_card(_user_id UUID, _card_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cards c WHERE c.id = _card_id
    AND (c.created_by = _user_id OR is_card_assignee(_card_id, _user_id) OR is_card_team_member(_card_id, _user_id))
  );
$$;

-- 3. Migrate existing data BEFORE dropping columns
INSERT INTO public.card_assignees (card_id, profile_id)
SELECT id, assigned_to_profile FROM public.cards WHERE assigned_to_profile IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.card_teams (card_id, team_id)
SELECT id, assigned_to_team FROM public.cards WHERE assigned_to_team IS NOT NULL
ON CONFLICT DO NOTHING;

-- 4. Drop ALL policies that reference old columns BEFORE dropping columns
DROP POLICY IF EXISTS "Assignee can update card status" ON public.cards;
DROP POLICY IF EXISTS "Users can view accessible cards" ON public.cards;

-- 5. Now safe to drop old columns
ALTER TABLE public.cards DROP COLUMN IF EXISTS assigned_to_profile;
ALTER TABLE public.cards DROP COLUMN IF EXISTS assigned_to_team;

-- 6. Recreate cards policies with new functions
CREATE POLICY "Users can view accessible cards"
ON public.cards FOR SELECT TO authenticated
USING (created_by = auth.uid() OR is_card_assignee(id, auth.uid()) OR is_card_team_member(id, auth.uid()));

CREATE POLICY "Assignee can update card status"
ON public.cards FOR UPDATE TO authenticated
USING (is_card_assignee(id, auth.uid()) AND created_by <> auth.uid())
WITH CHECK (is_card_assignee(id, auth.uid()) AND title = title AND card_type = card_type AND priority = priority AND start_date = start_date AND all_day = all_day AND created_by = created_by);

-- 7. RLS for card_assignees
DROP POLICY IF EXISTS "Users with card access can view card_assignees" ON public.card_assignees;
CREATE POLICY "Users with card access can view card_assignees"
ON public.card_assignees FOR SELECT TO authenticated USING (can_access_card(auth.uid(), card_id));

DROP POLICY IF EXISTS "Card creator can insert card_assignees" ON public.card_assignees;
CREATE POLICY "Card creator can insert card_assignees"
ON public.card_assignees FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.cards WHERE id = card_id AND created_by = auth.uid()));

DROP POLICY IF EXISTS "Card creator can delete card_assignees" ON public.card_assignees;
CREATE POLICY "Card creator can delete card_assignees"
ON public.card_assignees FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.cards WHERE id = card_id AND created_by = auth.uid()));

-- 8. RLS for card_teams
DROP POLICY IF EXISTS "Users with card access can view card_teams" ON public.card_teams;
CREATE POLICY "Users with card access can view card_teams"
ON public.card_teams FOR SELECT TO authenticated USING (can_access_card(auth.uid(), card_id));

DROP POLICY IF EXISTS "Card creator can insert card_teams" ON public.card_teams;
CREATE POLICY "Card creator can insert card_teams"
ON public.card_teams FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.cards WHERE id = card_id AND created_by = auth.uid()));

DROP POLICY IF EXISTS "Card creator can delete card_teams" ON public.card_teams;
CREATE POLICY "Card creator can delete card_teams"
ON public.card_teams FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.cards WHERE id = card_id AND created_by = auth.uid()));
