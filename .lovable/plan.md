

# Fix: Deleting a ritual fails due to foreign key constraint on task_history

## Problem

When deleting a ritual, the cascade flows like this:

```text
DELETE rituals (id)
  → CASCADE DELETE ritual_occurrences (ritual_id)
    → task_history has FK (ritual_occurrence_id → ritual_occurrences.id) with NO CASCADE
    → ERROR: foreign key violation
```

The `cards` table is fine (uses `ON DELETE SET NULL`), but `task_history.ritual_occurrence_id` uses the default `RESTRICT`, which blocks the delete.

There are currently 3 `task_history` rows referencing occurrences of the existing ritual, confirming this is the cause.

## Solution

Create a database migration to alter the foreign key on `task_history.ritual_occurrence_id` to use `ON DELETE SET NULL` instead of `RESTRICT`. This matches the behavior already used by `cards.ritual_occurrence_id` — the history record is preserved but the occurrence reference becomes null.

### Migration SQL

```sql
ALTER TABLE public.task_history
  DROP CONSTRAINT task_history_ritual_occurrence_id_fkey,
  ADD CONSTRAINT task_history_ritual_occurrence_id_fkey
    FOREIGN KEY (ritual_occurrence_id)
    REFERENCES public.ritual_occurrences(id)
    ON DELETE SET NULL;
```

No code changes needed — the delete logic in `useRituals.ts` and `RitualDetailPage.tsx` is correct. The issue is purely a database constraint.

## What stays the same

- No changes to any React components, hooks, pages, or schema structure
- Task history records are preserved (only the `ritual_occurrence_id` field becomes null)
- Cards already handle this correctly with `ON DELETE SET NULL`

