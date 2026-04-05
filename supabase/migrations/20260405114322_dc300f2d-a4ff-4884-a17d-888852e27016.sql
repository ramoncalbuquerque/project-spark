ALTER TABLE public.task_history
  DROP CONSTRAINT task_history_ritual_occurrence_id_fkey,
  ADD CONSTRAINT task_history_ritual_occurrence_id_fkey
    FOREIGN KEY (ritual_occurrence_id)
    REFERENCES public.ritual_occurrences(id)
    ON DELETE SET NULL;