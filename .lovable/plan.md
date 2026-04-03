

# Perfil + Polish + Correções — Plano Final MVP

## Resumo

Profile page já existe e está funcional. Foco principal: correções obrigatórias (sidebar sem useCards, MonthView com botão "+", useCards resiliente) e polish de UX.

## Arquivos a alterar

| Arquivo | Mudança |
|---------|---------|
| `src/components/AppSidebar.tsx` | Remover `useCards`, `isCardOverdue`, `pendingByTeam`. Times mostram apenas `member_count` |
| `src/components/calendar/MonthView.tsx` | Clique no dia → navega DayView (leader e member). Botão "+" no hover (leader only) chama `openCreateModal` |
| `src/hooks/useCards.ts` | Wrap enrichment queries em try/catch — fallback `assignees: [], teams: []` |
| `src/components/calendar/WeekView.tsx` | Empty state quando sem cards. Skeleton no loading. Hover scale nos cards |
| `src/components/calendar/DayView.tsx` | Empty state quando sem cards. Skeleton no loading. Hover scale nos cards |
| `src/components/calendar/CalendarCard.tsx` | Adicionar `transition-transform hover:scale-[1.02]` |
| `src/components/calendar/CardFormModal.tsx` | Esc fecha modal (já nativo do Dialog). Kbd handler Ctrl+Enter salva |
| `src/contexts/CalendarContext.tsx` | Confirmar defaultFilters todos null (já está correto no código atual) |

## Detalhes técnicos

### 1. AppSidebar — remover useCards
- Remover linhas 29-30 (imports de `useCards` e `isCardOverdue`)
- Remover linha 44 (`const { cards: allCards } = useCards()`)
- Remover linhas 49-56 (cálculo `pendingByTeam`)
- Na lista de times, remover o badge de pendingCount (linhas 258-262), manter apenas `member_count`

### 2. MonthView — botão "+" separado
- `handleDayClick` agora navega para DayView para todos (leader e member): `setSelectedDate(day); setViewMode("day")`
- Adicionar botão "+" (16x16, Plus icon) no canto superior direito de cada célula, visível no hover (desktop) ou sempre (mobile)
- Botão "+" com `e.stopPropagation()` chama `openCreateModal(day)`
- Visível apenas para leaders

### 3. useCards — try/catch no enrichment
- Envolver o `Promise.all` de assignees/teams em try/catch
- No catch, log o erro e retornar cards com `assignees: [], teams: []`

### 4. Polish visual
- **Empty states**: WeekView e DayView exibem mensagem "Nenhuma demanda para este período" com ícone quando `cards.length === 0 && !isLoading`
- **Loading skeletons**: Quando `isLoading`, mostrar 3-4 skeleton bars na área do calendário
- **Hover nos cards**: `hover:scale-[1.02] transition-transform` no CalendarCard wrapper
- **Transições de view**: Já existem via re-render; adicionar `animate-in fade-in` sutil no container da view

### 5. CalendarContext — verificação
- `defaultFilters` já tem todos os campos null — nenhuma mudança necessária

