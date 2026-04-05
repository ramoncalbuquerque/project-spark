

# Fix: Assignee selector across TaskDetail, QuickCreateBar, and FeedCard

## Problem
The TaskDetailPage shows assignees as read-only badges with no way to add/remove them. QuickCreateBar creates tasks without any assignee option. FeedCard already shows one avatar but doesn't handle multiple assignees well.

## Solution

### 1. Create shared hook: `useAssigneeOptions`
New file `src/hooks/useAssigneeOptions.ts` that fetches both `profiles` and `contacts` (unlinked) and returns a unified list:
- Each item: `{ id, full_name, avatar_url, type: 'profile' | 'contact' }`
- Profiles first, contacts second
- Current user always first as "Eu mesmo"
- Lightweight query (just id, full_name, avatar_url from profiles; id, full_name from contacts where linked_profile_id IS NULL)

### 2. Create shared component: `AssigneeSelector`
New file `src/components/shared/AssigneeSelector.tsx`
- Multi-select with chips using Popover + Command (combobox pattern from shadcn)
- Search input at top
- "Eu mesmo" pinned first
- Profiles shown with small "conta" badge, contacts with "sem conta" grey badge
- Selected people appear as removable chips above the dropdown
- Props: `selected: string[]`, `onChange: (ids: string[]) => void`, `compact?: boolean` (for QuickCreateBar)

### 3. Update TaskDetailPage — Metadata > Responsáveis
Replace the read-only badge list (lines 311-323) with the `AssigneeSelector` component.
- On change, call `updateAssignees.mutate(newIds)`
- Available to all users (both leaders and members can assign)

### 4. Update QuickCreateBar
- Add assignee state: `const [assigneeIds, setAssigneeIds] = useState<string[]>([])`
- After the date picker row, add a compact `AssigneeSelector`
- Update `createQuickTask` mutation in `useFeedCards.ts` to accept optional `assignee_ids: string[]`
- After card insert, if assignee_ids provided, insert into `card_assignees`

### 5. Update FeedCard avatars
Replace the single-avatar logic (lines 84-92) with:
- Show up to 2 stacked avatars (overlapping, -ml-2 on second)
- If more than 2, show "+N" badge
- If no assignees, render nothing

### 6. Update `useFeedCards` mutation
Extend `createQuickTask` to accept `assignee_ids?: string[]` and insert them into `card_assignees` after creating the card.

## Files changed
| File | Action |
|------|--------|
| `src/hooks/useAssigneeOptions.ts` | Create — shared profiles+contacts fetch |
| `src/components/shared/AssigneeSelector.tsx` | Create — multi-select combobox |
| `src/pages/v2/TaskDetailPage.tsx` | Edit — replace static badges with AssigneeSelector |
| `src/components/feed/QuickCreateBar.tsx` | Edit — add compact assignee picker |
| `src/components/feed/FeedCard.tsx` | Edit — stacked avatars (max 2 + "+N") |
| `src/hooks/useFeedCards.ts` | Edit — extend createQuickTask to handle assignees |

No database changes needed — `card_assignees` table and RLS policies already exist.

