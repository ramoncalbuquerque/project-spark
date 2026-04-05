
CREATE TABLE public.card_contact_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(card_id, contact_id)
);

ALTER TABLE public.card_contact_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with card access can view contact assignees"
ON public.card_contact_assignees FOR SELECT TO authenticated
USING (can_access_card(auth.uid(), card_id));

CREATE POLICY "Card creator can insert contact assignees"
ON public.card_contact_assignees FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM cards WHERE cards.id = card_contact_assignees.card_id AND cards.created_by = auth.uid()));

CREATE POLICY "Card creator can delete contact assignees"
ON public.card_contact_assignees FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM cards WHERE cards.id = card_contact_assignees.card_id AND cards.created_by = auth.uid()));
