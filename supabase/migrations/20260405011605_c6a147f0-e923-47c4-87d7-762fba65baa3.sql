
-- =============================================
-- SEMEAR V2 — SCHEMA MIGRATION
-- =============================================

-- PART 1A: ALTER EXISTING TABLES (profiles, teams)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS position TEXT,
  ADD COLUMN IF NOT EXISTS superior_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS hierarchy_level TEXT;

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS is_org_unit BOOLEAN DEFAULT false;

-- PART 2: CREATE NEW TABLES

-- projects
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- project_members
CREATE TABLE public.project_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, profile_id)
);

-- rituals
CREATE TABLE public.rituals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  frequency TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ritual_members
CREATE TABLE public.ritual_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ritual_id UUID NOT NULL REFERENCES public.rituals(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  UNIQUE(ritual_id, profile_id)
);

-- ritual_occurrences
CREATE TABLE public.ritual_occurrences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ritual_id UUID NOT NULL REFERENCES public.rituals(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- task_history
CREATE TABLE public.task_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  ritual_occurrence_id UUID REFERENCES public.ritual_occurrences(id),
  status_at_time TEXT,
  context_note TEXT,
  updated_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- contacts
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  department TEXT,
  position TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  linked_profile_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PART 1B: ALTER CARDS (after projects and ritual_occurrences exist)
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ritual_occurrence_id UUID REFERENCES public.ritual_occurrences(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origin_type TEXT DEFAULT 'standalone';

-- PART 3: SECURITY DEFINER FUNCTIONS

CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID, p_user_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND profile_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_ritual_member(p_ritual_id UUID, p_user_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ritual_members
    WHERE ritual_id = p_ritual_id AND profile_id = p_user_id
  );
$$;

-- Helper: is_project_creator
CREATE OR REPLACE FUNCTION public.is_project_creator(p_project_id UUID, p_user_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND created_by = p_user_id
  );
$$;

-- Helper: is_ritual_creator
CREATE OR REPLACE FUNCTION public.is_ritual_creator(p_ritual_id UUID, p_user_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rituals
    WHERE id = p_ritual_id AND created_by = p_user_id
  );
$$;

-- PART 4: ENABLE RLS ON ALL NEW TABLES
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rituals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ritual_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ritual_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- RLS: projects
CREATE POLICY "Members or creator can view projects" ON public.projects
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR is_project_member(id, auth.uid()));

CREATE POLICY "Leaders can create projects" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND get_user_role(auth.uid()) = 'leader');

CREATE POLICY "Creator can update projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creator can delete projects" ON public.projects
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- RLS: project_members
CREATE POLICY "Project members can view project_members" ON public.project_members
  FOR SELECT TO authenticated
  USING (is_project_member(project_id, auth.uid()) OR is_project_creator(project_id, auth.uid()));

CREATE POLICY "Project creator can add members" ON public.project_members
  FOR INSERT TO authenticated
  WITH CHECK (is_project_creator(project_id, auth.uid()));

CREATE POLICY "Project creator can remove members" ON public.project_members
  FOR DELETE TO authenticated
  USING (is_project_creator(project_id, auth.uid()));

-- RLS: rituals
CREATE POLICY "Members or creator can view rituals" ON public.rituals
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR is_ritual_member(id, auth.uid()));

CREATE POLICY "Leaders can create rituals" ON public.rituals
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND get_user_role(auth.uid()) = 'leader');

CREATE POLICY "Creator can update rituals" ON public.rituals
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creator can delete rituals" ON public.rituals
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- RLS: ritual_members
CREATE POLICY "Ritual members or creator can view" ON public.ritual_members
  FOR SELECT TO authenticated
  USING (is_ritual_member(ritual_id, auth.uid()) OR is_ritual_creator(ritual_id, auth.uid()));

CREATE POLICY "Ritual creator can add members" ON public.ritual_members
  FOR INSERT TO authenticated
  WITH CHECK (is_ritual_creator(ritual_id, auth.uid()));

CREATE POLICY "Ritual creator can remove members" ON public.ritual_members
  FOR DELETE TO authenticated
  USING (is_ritual_creator(ritual_id, auth.uid()));

-- RLS: ritual_occurrences
CREATE POLICY "Ritual members can view occurrences" ON public.ritual_occurrences
  FOR SELECT TO authenticated
  USING (is_ritual_member(ritual_id, auth.uid()) OR is_ritual_creator(ritual_id, auth.uid()));

CREATE POLICY "Ritual members can create occurrences" ON public.ritual_occurrences
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (is_ritual_member(ritual_id, auth.uid()) OR is_ritual_creator(ritual_id, auth.uid())));

CREATE POLICY "Ritual members can update occurrences" ON public.ritual_occurrences
  FOR UPDATE TO authenticated
  USING (is_ritual_member(ritual_id, auth.uid()) OR is_ritual_creator(ritual_id, auth.uid()));

CREATE POLICY "Ritual creator can delete occurrences" ON public.ritual_occurrences
  FOR DELETE TO authenticated
  USING (is_ritual_creator(ritual_id, auth.uid()));

-- RLS: task_history
CREATE POLICY "Users with card access can view history" ON public.task_history
  FOR SELECT TO authenticated
  USING (can_access_card(auth.uid(), card_id));

CREATE POLICY "Users with card access can insert history" ON public.task_history
  FOR INSERT TO authenticated
  WITH CHECK (updated_by = auth.uid() AND can_access_card(auth.uid(), card_id));

-- RLS: contacts (leaders only)
CREATE POLICY "Leaders can view contacts" ON public.contacts
  FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = 'leader');

CREATE POLICY "Leaders can create contacts" ON public.contacts
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND get_user_role(auth.uid()) = 'leader');

CREATE POLICY "Leaders can update contacts" ON public.contacts
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = 'leader')
  WITH CHECK (get_user_role(auth.uid()) = 'leader');

CREATE POLICY "Leaders can delete contacts" ON public.contacts
  FOR DELETE TO authenticated
  USING (get_user_role(auth.uid()) = 'leader');

-- PART 5: TRIGGERS

-- updated_at triggers for new tables
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rituals_updated_at
  BEFORE UPDATE ON public.rituals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Validation trigger: profiles.hierarchy_level
CREATE OR REPLACE FUNCTION public.validate_hierarchy_level()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.hierarchy_level IS NOT NULL AND NEW.hierarchy_level NOT IN ('alto', 'medio', 'baixo') THEN
    RAISE EXCEPTION 'hierarchy_level must be alto, medio, baixo or NULL';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_profiles_hierarchy_level
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION validate_hierarchy_level();

-- Validation trigger: cards.origin_type
CREATE OR REPLACE FUNCTION public.validate_origin_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.origin_type IS NOT NULL AND NEW.origin_type NOT IN ('standalone', 'project', 'ritual', 'meeting') THEN
    RAISE EXCEPTION 'origin_type must be standalone, project, ritual or meeting';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_cards_origin_type
  BEFORE INSERT OR UPDATE ON public.cards
  FOR EACH ROW EXECUTE FUNCTION validate_origin_type();
