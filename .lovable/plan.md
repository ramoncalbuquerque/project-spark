# Importação em massa de Ritualísticas históricas

## Resumo
Criar página temporária `/app/import-rituals` para importação CSV de dados históricos de ritualísticas com carry-forward. Adicionar status "cancelled" ao sistema.

## Mudanças

### 1. Adicionar status "cancelled" ao sistema
- Adicionar visual para cancelled: ícone X vermelho, texto riscado com opacity 0.5
- Atualizar `OccurrenceDetail.tsx` (renderização de status dos cards na ocorrência)
- NÃO tocar em FeedCard conforme instrução

### 2. Criar página ImportRitualsPage.tsx
Página com 3 telas (estados):

**Tela 1 — Upload**: Botão upload CSV, texto com formato esperado

**Tela 2 — Preview**: Após parsing do CSV:
- Resumo: N ritualísticas · N ocorrências · N tarefas · N carry-forwards
- Lista com nome, responsável (match/warning), contadores
- Warnings de responsáveis não encontrados
- Botões "Importar tudo" + "Cancelar"

**Tela 3 — Progresso**: Progress bar com fases, log de erros/warnings, botão final

**Lógica de importação**:
1. Agrupar CSV por ritual_name → criar rituals + ritual_members
2. Agrupar por ritual_name + occurrence_date → criar ritual_occurrences (status=closed)
3. Processar itens em ordem cronológica por ritualística:
   - Mapa `Map<key, {card_id, lastStatus, lastContext, lastOccId}>` para carry-forward
   - Normalização: lowercase, trim, remover parênteses, fuzzy match (primeiras palavras)
   - Primeira aparição → criar card + task_history + card_assignees
   - Reaparição → atualizar card status/occurrence, criar task_history com dados anteriores
4. Batches de 10, erros não param importação

### 3. Rota e navegação
- Rota `/app/import-rituals` no App.tsx (dentro de ProtectedRoute)
- Botão na RitualsPage visível apenas para leaders
- Buscar profiles e contacts para matching de responsáveis

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/pages/v2/ImportRitualsPage.tsx` | **NOVO** — Página completa de importação |
| `src/App.tsx` | Adicionar rota |
| `src/pages/v2/RitualsPage.tsx` | Botão "Importar R.A.s históricas" para leaders |
| `src/components/rituals/OccurrenceDetail.tsx` | Visual do status cancelled |

## NÃO tocar em
Feed, Projetos, TaskDetail, Pessoas, Agenda, schema do banco