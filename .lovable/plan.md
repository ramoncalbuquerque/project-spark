# Plano: Sistema Completo de Cards

## Arquitetura

### Novo contexto: CardContext
- Estado: `isModalOpen`, `editingCard`, `defaultDate`
- Funções: `openCreateModal(date?)`, `openEditModal(card)`, `closeModal()`
- Provider no AppLayout (junto com CalendarProvider)

### Hook: useCards
- `useQuery` para buscar cards do período visível (baseado em selectedDate + viewMode)
- `useMutation` para create, update, delete
- Filtragem por data no frontend (RLS cuida da segurança)

### Componentes

| Componente | Responsabilidade |
|------------|-----------------|
| `CardContext` | Estado do modal e card em edição |
| `CardFormModal` | Modal fullscreen mobile, campos do card, salvar/cancelar/excluir |
| `CalendarCard` | Bloco visual colorido (azul/verde/roxo) com título + badge prioridade |

### Fluxo
1. Leader clica "+ Criar" ou slot vazio → `openCreateModal(date?)`
2. Modal abre com campos (data pré-preenchida se veio de slot)
3. Salvar → mutation insert → invalidate query → modal fecha
4. Clique em card existente → `openEditModal(card)` → modal com dados
5. Editar → mutation update | Excluir → confirmação → mutation delete

### Cores por tipo
- Tarefa: #1E88E5 (azul)
- Reunião: #2E7D32 (verde)  
- Projeto: #7B1FA2 (roxo)

### Prioridade badges
- Baixa: cinza | Média: amarelo | Alta: laranja | Urgente: vermelho

### Permissões
- Leader: CRUD completo, vê botão Criar, clique em slot funciona
- Member: só visualiza, sem botão Criar, clique em slot não faz nada

### Arquivos
- Novos: CardContext, useCards, CardFormModal, CalendarCard
- Alterados: AppSidebar (botão Criar), WeekView, DayView, MonthView, Dashboard, AppLayout