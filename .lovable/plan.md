

# Refatorar useCards.ts para card_assignees e card_teams

## Contexto

A tabela `cards` não tem mais `assigned_to_profile` e `assigned_to_team` nos tipos TypeScript (foram removidos do schema). Isso causa build errors em CalendarCard, CardFormModal e useCards. A solução é enriquecer os cards no hook e exportar um tipo compatível.

## Mudanças em useCards.ts

### 1. Tipo EnrichedCard com campos legados

```typescript
type AssigneeInfo = { id: string; full_name: string | null; avatar_url: string | null };
type TeamInfo = { id: string; name: string };

export type EnrichedCard = Card & {
  assignees: AssigneeInfo[];
  teams: TeamInfo[];
  // Campos legados computados para backward compatibility
  assigned_to_profile: string | null;
  assigned_to_team: string | null;
};
```

`assigned_to_profile` = primeiro assignee id (ou null). `assigned_to_team` = primeiro team id (ou null). Isso evita que CalendarCard e CardFormModal quebrem sem precisar editá-los agora.

### 2. Query enriquecida

Após buscar os cards, fazer duas queries paralelas:

- `card_assignees` filtrado por `card_id.in(cardIds)`, com select `card_id, profile_id, profiles(id, full_name, avatar_url)`
- `card_teams` filtrado por `card_id.in(cardIds)`, com select `card_id, team_id, teams(id, name)`

Montar mapa `cardId → assignees[]` e `cardId → teams[]`, depois enriquecer cada card.

### 3. Filtros atualizados

Em vez de `card.assigned_to_profile`, verificar se `card.assignees.some(a => a.id === filters.profileId)`. Idem para teams.

### 4. Mutations com gerência de junções

Aceitar parâmetros extras opcionais:

```typescript
type CreateCardInput = TablesInsert<"cards"> & {
  assignee_ids?: string[];
  team_ids?: string[];
};
```

Após INSERT/UPDATE do card:
1. DELETE de card_assignees WHERE card_id
2. INSERT em card_assignees para cada assignee_id
3. DELETE de card_teams WHERE card_id
4. INSERT em card_teams para cada team_id

### 5. Nota sobre build errors existentes

CalendarCard e CardFormModal importam `Tables<"cards">` diretamente e referenciam `assigned_to_profile`/`assigned_to_team`. Com o `EnrichedCard` exportando esses campos como propriedades computadas, basta trocar o tipo neles de `Card` para `EnrichedCard` — mas isso será feito num passo seguinte quando os componentes forem atualizados. **Para resolver os build errors agora**, será necessário também atualizar minimamente o tipo usado em CalendarCard e CardFormModal (de `Tables<"cards">` para `EnrichedCard`), o que envolve apenas trocar a importação de tipo, sem mudar lógica visual.

## Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useCards.ts` | Queries enriquecidas, EnrichedCard, mutations com junções |
| `src/components/calendar/CalendarCard.tsx` | Trocar tipo `Tables<"cards">` → `EnrichedCard` (só import) |
| `src/components/calendar/CardFormModal.tsx` | Trocar tipo `Tables<"cards">` → `EnrichedCard` (só import) |

