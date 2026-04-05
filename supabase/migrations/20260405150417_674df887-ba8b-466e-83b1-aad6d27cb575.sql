CREATE POLICY "Users with card access can update history"
ON public.task_history
FOR UPDATE
TO authenticated
USING (can_access_card(auth.uid(), card_id))
WITH CHECK (can_access_card(auth.uid(), card_id));