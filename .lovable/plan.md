

# Feed de Tarefas — Plano de Implementação

## Estratégia para useCards

O `useCards` atual é usado por 4 componentes do calendário v1 (DayView, WeekView, MonthView, CardFormModal). Não vou refatorá-lo — vou criar um **novo hook `useFeedCards`** dedicado ao feed, evitando quebrar o v1.

## Arquivos a criar

| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/useFeedCards.ts` | Hook dedicado ao feed: busca todos os cards do user (criado ou atribuído), sem dependência de CalendarContext. Enrichment de assignees, teams e project name. Filtro client-side por status (todos/atrasados/em_andamento/concluídos). Mutations de create/update/delete reutilizando `syncJunctions`. |
| `src/components/feed/FeedCard.tsx` | Card compacto: borda esquerda colorida por status, chips status+tipo, título, meta (prazo, assignee, checklist), chip projeto clicável, avatar 24px. Toque navega para `/app/task/:id`. |
| `src/components/feed/QuickCreateBar.tsx` | Barra sticky acima do bottom nav. Input "Delegar tarefa..." com ícone microfone. Ao focar expande mini-form (título + date picker + botão Criar). Cria card com `card_type: 'task'`, `origin_type: 'standalone'`. |

## Arquivo a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/v2/FeedPage.tsx` | Implementar tela completa: chips de filtro sticky, agrupamento por dia (Hoje, Amanhã, Próxima semana, Mais tarde), estado vazio, botão refresh, QuickCreateBar. |

## Detalhes técnicos

### useFeedCards

- Query sem date range fixo — busca todos os cards visíveis ao user (RLS já filtra por created_by, assignee ou team member)
- Enrichment: assignees + teams (igual ao existente) + project name via query separada em `projects` usando `project_id`s distintos
- `EnrichedFeedCard` extends `EnrichedCard` com `project_name: string | null`
- Filtro client-side: `statusFilter` pode ser `'all' | 'overdue' | 'in_progress' | 'completed'`
- Overdue = `status !== 'completed'` e `start_date < now()`
- `createQuickTask` mutation simplificada: recebe `{ title, start_date }`, seta `card_type: 'task'`, `created_by: user.id`
- QueryKey: `["feed-cards"]` (separada do calendário)

### FeedPage — agrupamento

Agrupa cards por:
1. **Hoje** — `isSameDay(start_date, today)`
2. **Amanhã** — `isSameDay(start_date, tomorrow)`
3. **Próxima semana** — `start_date` dentro dos próximos 7 dias (excl. hoje/amanhã)
4. **Mais tarde** — restante

Header de grupo: "Hoje — qui, 3 abr" com `format(date, "EEE, d MMM", { locale: ptBR })`

### FeedCard — cores da borda esquerda

| Status | Cor |
|--------|-----|
| overdue (pendente + passado) | `#EF4444` vermelho |
| in_progress | `#3B82F6` azul |
| completed | `#22C55E` verde |
| pending | `#94A3B8` cinza |

### QuickCreateBar

- Position: `sticky bottom-14` (acima do bottom nav de 56px)
- Estado colapsado: input + mic icon
- Estado expandido: título (preenchido), DatePicker (popover com Calendar shadcn), botão "Criar"
- Ao criar: chama `createQuickTask`, fecha o form, `invalidateQueries`

### Chips de filtro

- Horizontais, scroll-x se necessário
- "Atrasados" mostra badge contador vermelho
- Chip ativo: `bg-[#4F46E5] text-white`, inativo: `bg-[#F4F4F1] text-[#6B6B6B]`

## O que NÃO muda

- `useCards.ts` original — intocado, v1 continua funcionando
- CalendarContext, AppLayout, sidebar, componentes calendar
- Schema do banco, RLS, auth

