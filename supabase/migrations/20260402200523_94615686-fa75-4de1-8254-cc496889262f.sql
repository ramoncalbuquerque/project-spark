
-- ============================================
-- 1. TABLES
-- ============================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id),
  profile_id UUID NOT NULL REFERENCES public.profiles(id),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, profile_id)
);

CREATE TABLE public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  card_type TEXT NOT NULL CHECK (card_type IN ('task', 'meeting', 'project')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  all_day BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  assigned_to_profile UUID REFERENCES public.profiles(id),
  assigned_to_team UUID REFERENCES public.teams(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.agenda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- 2. HELPER FUNCTIONS (security definer)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.can_access_card(_user_id UUID, _card_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cards c
    WHERE c.id = _card_id
    AND (
      c.created_by = _user_id
      OR c.assigned_to_profile = _user_id
      OR EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.team_id = c.assigned_to_team
        AND tm.profile_id = _user_id
      )
    )
  );
$$;

-- ============================================
-- 3. TRIGGER: auto-create profile on signup
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'member'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 4. updated_at trigger
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cards_updated_at BEFORE UPDATE ON public.cards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 5. RLS
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Authenticated users can view all profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- TEAMS
CREATE POLICY "Members and creator can view team"
  ON public.teams FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = id AND tm.profile_id = auth.uid())
  );

CREATE POLICY "Creator can insert teams"
  ON public.teams FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creator can update teams"
  ON public.teams FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creator can delete teams"
  ON public.teams FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- TEAM_MEMBERS
CREATE POLICY "Members and team creator can view team_members"
  ON public.team_members FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.created_by = auth.uid())
  );

CREATE POLICY "Team creator can add members"
  ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.created_by = auth.uid()));

CREATE POLICY "Team creator can remove members"
  ON public.team_members FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.created_by = auth.uid()));

-- CARDS
CREATE POLICY "Users can view accessible cards"
  ON public.cards FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR assigned_to_profile = auth.uid()
    OR EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = assigned_to_team AND tm.profile_id = auth.uid())
  );

CREATE POLICY "Leaders can create cards"
  ON public.cards FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.get_user_role(auth.uid()) = 'leader');

CREATE POLICY "Creator can update own cards"
  ON public.cards FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE POLICY "Assignee can update card status"
  ON public.cards FOR UPDATE TO authenticated
  USING (assigned_to_profile = auth.uid() AND created_by != auth.uid())
  WITH CHECK (
    assigned_to_profile = auth.uid()
    AND title = title
    AND description IS NOT DISTINCT FROM description
    AND card_type = card_type
    AND priority = priority
    AND start_date = start_date
    AND end_date IS NOT DISTINCT FROM end_date
    AND all_day = all_day
    AND created_by = created_by
    AND assigned_to_profile IS NOT DISTINCT FROM assigned_to_profile
    AND assigned_to_team IS NOT DISTINCT FROM assigned_to_team
  );

CREATE POLICY "Creator can delete cards"
  ON public.cards FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- AGENDA_ITEMS
CREATE POLICY "Users with card access can view agenda items"
  ON public.agenda_items FOR SELECT TO authenticated
  USING (public.can_access_card(auth.uid(), card_id));

CREATE POLICY "Users with card access can create agenda items"
  ON public.agenda_items FOR INSERT TO authenticated
  WITH CHECK (public.can_access_card(auth.uid(), card_id));

CREATE POLICY "Users with card access can update agenda items"
  ON public.agenda_items FOR UPDATE TO authenticated
  USING (public.can_access_card(auth.uid(), card_id))
  WITH CHECK (public.can_access_card(auth.uid(), card_id));

CREATE POLICY "Card creator can delete agenda items"
  ON public.agenda_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cards c WHERE c.id = card_id AND c.created_by = auth.uid()));

-- ATTACHMENTS
CREATE POLICY "Users with card access can view attachments"
  ON public.attachments FOR SELECT TO authenticated
  USING (public.can_access_card(auth.uid(), card_id));

CREATE POLICY "Users with card access can upload attachments"
  ON public.attachments FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND public.can_access_card(auth.uid(), card_id));

CREATE POLICY "Uploader or card creator can delete attachments"
  ON public.attachments FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.cards c WHERE c.id = card_id AND c.created_by = auth.uid())
  );
