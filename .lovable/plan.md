# Projetos — Plano de Implementação

## Arquivos a criar

| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/useProjects.ts` | Hook CRUD de projetos: lista projetos onde user é criador ou membro (join project_members→profiles). Contadores de cards por status por projeto. Mutations: create (nome+desc+membros), update, delete, addMember, removeMember. |
| `src/components/projects/CreateProjectModal.tsx` | Modal de criação: campo nome (obrigatório), descrição, multi-select de membros (busca profiles, chips com X). Botão Criar chama `createProject`. |
| `src/components/projects/ProjectCard.tsx` | Card de projeto para a lista: nome, barra de progresso mini (verde = % concluído), texto "X abertas · Y em andamento · Z concluídas", badge status. Toque navega para `/app/project/:id`. |

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/v2/ProjectsPage.tsx` | Implementar: botão "+ Novo projeto" (só leaders), lista de ProjectCards, estado vazio, CreateProjectModal. |
| `src/pages/v2/ProjectDetailPage.tsx` | Header editável + status badge, 4 mini-cards contadores, barra progresso colorida, lista FeedCards filtrados por project_id, seção "Discutido em", botão "+ Nova tarefa", gerenciar membros. |

## Detalhes técnicos

### useProjects

- Query: `projects` com `project_members(profile_id, profiles(id, full_name, avatar_url))`
- Contadores: query separada em `cards` agrupando por project_id + status. Client-side merge.
- `EnrichedProject`: project row + `members: {id, full_name, avatar_url}[]` + `counts: {pending, in_progress, completed, overdue, total}`
- Overdue: status !== 'completed' AND start_date < now()
- Mutations: createProject (insert projects + bulk project_members), updateProject, deleteProject, addMember, removeMember
- QueryKey: `["projects"]`

### ProjectsPage

- Header "Projetos" + botão "+" (só leader)
- Lista de ProjectCards
- Empty state: FolderOpen icon + "Nenhum projeto ainda"

### ProjectDetailPage

- Busca por useParams id
- Header: nome editável inline (só creator) + badge status
- 4 mini-cards grid 2x2: Total (cinza), Atrasadas (vermelho), Em andamento (azul), Concluídas (verde)
- Barra progresso multicolorida (vermelho+azul+verde proporcional)
- Tarefas: reutiliza FeedCard, dados filtrados por project_id
- "Discutido em": ritual_occurrences que têm cards com este project_id
- Botão sticky "+ Nova tarefa" com project_id preenchido
- Membros: lista com avatar + add/remove (só creator)

### Cores barra de progresso

| Segmento | Cor |
|----------|-----|
| Concluídas | `#22C55E` |
| Em andamento | `#3B82F6` |
| Atrasadas | `#EF4444` |
| Pendentes | `#E2E8F0` |

## O que NÃO muda

- FeedPage, FeedCard (apenas reutilizado), TaskDetailPage
- AppShellV2, BottomNav, schema, RLS, auth