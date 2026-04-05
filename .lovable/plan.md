

# Proteções de Segurança para Ocorrências e Ritualísticas

## Resumo

Adicionar modais de confirmação detalhados ao excluir ocorrências e ritualísticas, preservando cards (desvinculando em vez de deletar). Tornar o carry-forward resiliente a ocorrências deletadas.

## Mudanças

### 1. Excluir ocorrência com proteção (OccurrenceDetail.tsx)

Adicionar botão "Excluir ocorrência" (apenas para ocorrências abertas, ao lado de "Fechar ocorrência") com AlertDialog customizado:
- Texto dinâmico: "Esta ocorrência tem {cards.length} itens e notas."
- Ao confirmar:
  1. `UPDATE cards SET ritual_occurrence_id = NULL WHERE ritual_occurrence_id = occurrence.id`
  2. `UPDATE task_history SET ritual_occurrence_id = NULL WHERE ritual_occurrence_id = occurrence.id` (precisa de RLS policy UPDATE para task_history)
  3. `DELETE ritual_occurrences WHERE id = occurrence.id`
  4. Toast: "Ocorrência excluída. As tarefas foram preservadas."
  5. Invalidar queries

**Migração necessária**: Adicionar RLS policy UPDATE em `task_history` para que o usuário possa setar `ritual_occurrence_id = null`. Também adicionar DELETE policy em `ritual_occurrences` para creator (já existe via `is_ritual_creator`).

### 2. Excluir ritualística com proteção (RitualDetailPage.tsx)

Substituir o AlertDialog atual por versão enriquecida:
- Buscar contagem de ocorrências e cards vinculados antes de exibir o modal
- Texto: "A ritualística '{name}' tem {X} ocorrências e {Y} tarefas vinculadas."
- Ao confirmar:
  1. Buscar todos os `ritual_occurrence` IDs desta ritualística
  2. `UPDATE cards SET ritual_occurrence_id = NULL WHERE ritual_occurrence_id IN (...)` 
  3. `UPDATE task_history SET ritual_occurrence_id = NULL WHERE ritual_occurrence_id IN (...)`
  4. `DELETE rituals WHERE id = ritual.id` (cascade deleta occurrences e members)
  5. Navegar para `/app/rituals`

### 3. Carry-forward resiliente (useCarryForward.ts)

A lógica atual já busca a ocorrência mais recente por data (`ORDER BY date DESC LIMIT 1`), então naturalmente pega a "penúltima" se a última foi deletada. Nenhuma mudança estrutural necessária.

Porém, adicionar fallback: se nenhuma ocorrência existe mas há cards com `origin_type = 'ritual'` e `ritual_occurrence_id IS NULL` que pertencem a esta ritualística (via assignees que são membros), buscá-los como pendentes. Na prática isso é edge case raro e o retorno atual de `pendingItems: []` com mensagem "Nenhum item pendente" já é adequado. Manter simples.

### 4. Migração SQL

```sql
-- Allow authenticated users to update task_history (for nullifying ritual_occurrence_id)
CREATE POLICY "Users with card access can update history"
ON public.task_history
FOR UPDATE
TO authenticated
USING (can_access_card(auth.uid(), card_id))
WITH CHECK (can_access_card(auth.uid(), card_id));
```

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Policy UPDATE em task_history |
| `src/components/rituals/OccurrenceDetail.tsx` | Botão + modal de excluir ocorrência com lógica de desvinculação |
| `src/pages/v2/RitualDetailPage.tsx` | Modal de excluir ritualística com contagens dinâmicas e desvinculação de cards |
| `src/hooks/useCarryForward.ts` | Nenhuma mudança (já resiliente) |

### Arquivos NÃO tocados
FeedCard, layout da ocorrência, Projetos, Agenda, Pessoas.

