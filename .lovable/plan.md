# Reimplementar fluxo "Nova Ocorrência" com tela de revisão e carry-forward visual

## Arquivos a criar/editar

### 1. `src/hooks/useCarryForward.ts` — Refatorar
- Buscar última ocorrência (mais recente por data)
- Buscar cards vinculados com status != 'completed'
- Para cada card: buscar assignees (profiles) + task_history count (quantas ocorrências já passou)
- Retornar: `{ pendingItems: EnrichedPendingCard[], completedCount: number, lastOccurrenceDate: string | null, isLoading }`

### 2. `src/components/rituals/CarryForwardReviewModal.tsx` — Criar
- Modal fullscreen mobile
- Lista de itens pendentes com checkbox pré-marcado, nome + responsável + "desde MES/ANO · N ocorrências", dot status
- Resumo no rodapé: "X itens serão puxados · Y concluídos desde a última"
- Se vazio: "Nenhum item pendente. A ocorrência será criada vazia."
- Botão "Criar ocorrência" + "Cancelar"

### 3. `src/pages/v2/RitualDetailPage.tsx` — Editar
- Botão "Nova Ocorrência" abre CarryForwardReviewModal
- Ao confirmar: cria occurrence, move cards selecionados, insere task_history

### 4. `src/components/rituals/OccurrenceDetail.tsx` — Reimplementar
- Seção 1: Resumo (fundo primary claro)
- Seção 2: Notas (borda esquerda primary, debounce 1s)
- Seção 3: Itens com círculo status 28px clicável (rotação pending→in_progress→completed→not_done), observação colapsável, concluídos agrupados no final
- + Adicionar item inline com responsável
- Fechar ocorrência

## Sem alterações de schema
