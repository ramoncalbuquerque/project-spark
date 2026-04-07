

## Problem

The department selector on the signup page never appears for two reasons:

1. **RLS blocks the query**: The `profiles` table requires `authenticated` role for SELECT. On `/signup`, the user is unauthenticated, so `SELECT department FROM profiles` returns empty → `departments.length === 0` → dropdown hidden.

2. **No way to create a new department**: Even if the query worked, a leader of a brand-new department couldn't type their own department name.

## Solution

### 1. Database: Allow anonymous read of department list

Create a `SECURITY DEFINER` function that returns distinct department names without requiring authentication:

```sql
CREATE OR REPLACE FUNCTION public.get_departments()
RETURNS SETOF TEXT AS $$
  SELECT DISTINCT department FROM public.profiles
  WHERE department IS NOT NULL
  ORDER BY department
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### 2. Frontend: Use the RPC function + allow custom input

In `Signup.tsx`:

- Replace the direct `supabase.from("profiles").select("department")` with `supabase.rpc("get_departments")`
- Change the condition from `departments.length > 0` to just `accountRole` (always show when a role is selected)
- Add a "Outro" option at the end of the Select that reveals a text Input for typing a custom department name
- This way leaders can pick an existing department OR create a new one

### Files changed
- **Migration**: New SQL function `get_departments()`
- **`src/pages/Signup.tsx`**: Switch to RPC call, always show department field when role selected, add custom department input option

