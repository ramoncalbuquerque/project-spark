# Ritualísticas — Plano de Implementação

## Arquivos a criar

| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/useRituals.ts` | Hook CRUD de ritualísticas: lista rituals onde user é criador ou membro (join ritual_members→profiles). Enrich com: membros, última ocorrência (data), contagem de pendentes (cards vinculados à última ocorrência com status != completed). Mutations: create (nome+freq+membros), update, delete, addMember, removeMember. QueryKey: `["rituals"]`. |
| `src/hooks/useRitualOccurrences.ts` | Hook para ocorrências de uma ritualística: lista ritual_occurrences por ritual_id ordenadas por data DESC. Para cada ocorrência: count de cards vinculados (total + completed). Mutation: createOccurrence, updateOccurrence (notas, status). QueryKey: `["ritual-occurrences", ritualId]`. |
| `src/hooks/useCarryForward.ts` | Hook que recebe ritualId. Busca a última ocorrência. Busca cards com ritual_occurrence_id = essa ocorrência e status != 'completed'. Retorna lista de tarefas pendentes para carry-forward. Função `executeCarryForward(newOccurrenceId)`: para cada tarefa pendente, atualiza card.ritual_occurrence_id para newOccurrenceId e insere task_history com status_at_time + context_note. |
| `src/components/rituals/CreateRitualModal.tsx` | Modal: nome (obrigatório), frequência (select: weekly/biweekly/monthly/custom), multi-select membros. |
| `src/components/rituals/RitualCard.tsx` | Card para lista: nome, avatares empilhados (max 4 + "+N"), texto "Última: 12 mar 2026 · 4 pendentes", badge vermelho se pendentes > 0. Toque navega para `/app/ritual/:id`. |
| `src/components/rituals/OccurrenceDetail.tsx` | Componente para detalhe de uma ocorrência: data + status, lista de cards (dot colorido + título + assignee + "desde X · N atualizações"), input para nota de contexto inline, botão "+ Adicionar novo item", campo notas gerais, botão "Fechar ocorrência". |

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/v2/RitualsPage.tsx` | Implementar: botão "+ Nova ritualística" (só leaders), lista de RitualCards, empty state, CreateRitualModal. |
| `src/pages/v2/RitualDetailPage.tsx` | Implementar: header (nome + freq + badge), botão "Nova ocorrência" (cria + carry-forward + navega), lista de ocorrências anteriores, e ao clicar numa ocorrência abre OccurrenceDetail inline (accordion/expandido). |
| `src/App.tsx` | Adicionar rota `/app/ritual/:id/occurrence/:occId` (ou manter tudo no RitualDetailPage com state). |

## Detalhes técnicos

### useRituals

- Query: `rituals` com select `*, ritual_members(profile_id, profiles(id, full_name, avatar_url))`
- Para última ocorrência + pendentes: query separada em `ritual_occurrences` (última por ritual_id) + count de cards pendentes vinculados
- `EnrichedRitual`: ritual row + `members: ProfileInfo[]` + `lastOccurrence: { date: string, pendingCount: number } | null`
- Mutations: createRitual (insert rituals + bulk ritual_members), updateRitual, deleteRitual

### useRitualOccurrences

- Query: `ritual_occurrences` onde ritual_id = param, order by date DESC
- Para cada: count cards (total + done) via query em cards onde ritual_occurrence_id = occ.id
- `EnrichedOccurrence`: occ row + `cardCount: number` + `completedCount: number`

### useCarryForward

- Input: ritualId
- Busca última ocorrência: `ritual_occurrences.select().eq(ritual_id).order(date, desc).limit(1)`
- Busca cards pendentes: `cards.select().eq(ritual_occurrence_id, lastOcc.id).neq(status, 'completed')`
- `executeCarryForward(newOccId)`:
  1. Para cada card pendente: update `ritual_occurrence_id` para newOccId
  2. Insert task_history: `{ card_id, ritual_occurrence_id: newOccId, status_at_time: card.status, updated_by: user.id, context_note: 'Carry-forward automático' }`

### Fluxo "Nova Ocorrência"

1. User clica "Nova ocorrência"
2. Insert `ritual_occurrences` com date=now(), status='open', ritual_id, created_by
3. Chama `executeCarryForward(newOcc.id)` — puxa pendentes da última ocorrência
4. Expande/navega para a nova ocorrência

### OccurrenceDetail

- Header: data formatada + badge status (Aberta/Fechada)
- Lista de cards vinculados (ritual_occurrence_id = occ.id):
  - Dot de status (mesmas cores do FeedCard)
  - Título
  - Assignee avatar
  - "desde jul/25" = primeira entry em task_history para este card
  - "3 atualizações" = count de task_history para este card
  - Toque → navigate(`/app/task/${card.id}`)
- Botão "Atualizar contexto" por item: input inline → salva task_history com context_note
- Botão "+ Adicionar novo item": cria card com ritual_occurrence_id + card_type='task' + origin_type='ritual'
- Textarea notas gerais: salva em ritual_occurrences.notes
- Botão "Fechar ocorrência": update status='closed'

### RitualDetailPage — layout

- Sticky header: nome + freq + badge pendentes
- Botão "Nova ocorrência" grande indigo (sticky ou destaque no topo)
- Lista de ocorrências como accordion:
  - Fechada: "15 mar 2026 · 5 itens · 3 concluídos"
  - Aberta: renderiza OccurrenceDetail inline
- A ocorrência mais recente aberta por padrão

### Cores/design

- Badge pendentes: `bg-[#EF4444]/10 text-[#EF4444]` se > 0
- Frequência labels: weekly="Semanal", biweekly="Quinzenal", monthly="Mensal", custom="Personalizada"
- Status dots nas tarefas: mesmas cores do FeedCard (overdue=#EF4444, in_progress=#3B82F6, completed=#22C55E, pending=#94A3B8)

## O que NÃO muda

- FeedPage, FeedCard (reutilizado read-only), ProjectsPage, ProjectDetailPage, TaskDetailPage
- AppShellV2, BottomNav
- Schema do banco, RLS, auth
- useCards, useFeedCards, useProjects