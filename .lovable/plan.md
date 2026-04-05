

# Layout Mobile-First v2 com Bottom Navigation

## Arquivos a criar

| Arquivo | Descrição |
|---------|-----------|
| `src/components/AppShellV2.tsx` | Layout wrapper: header mínimo (48px) + `<Outlet />` scrollável + bottom nav fixo (56px) |
| `src/components/BottomNav.tsx` | 5 abas com ícones Lucide (Home, Users, Calendar, FolderOpen, Repeat), label 10px, touch 44x44, ativo indigo #4F46E5, inativo #94A3B8 |
| `src/pages/v2/FeedPage.tsx` | Placeholder "Em construção" |
| `src/pages/v2/PeoplePage.tsx` | Placeholder |
| `src/pages/v2/AgendaPage.tsx` | Placeholder |
| `src/pages/v2/ProjectsPage.tsx` | Placeholder |
| `src/pages/v2/RitualsPage.tsx` | Placeholder |
| `src/pages/v2/TaskDetailPage.tsx` | Placeholder |
| `src/pages/v2/ProjectDetailPage.tsx` | Placeholder |
| `src/pages/v2/RitualDetailPage.tsx` | Placeholder |

## Arquivo a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/App.tsx` | Adicionar bloco de rotas `/app/*` dentro de `AppShellV2` (protegido). Mudar redirect `/` de `/dashboard` para `/app/feed`. Manter rotas antigas intactas. |

## Detalhes técnicos

### AppShellV2
- Sem sidebar, sem `SidebarProvider`
- Header: `h-12`, fundo `#FAFAF8`, borda `border-b border-[#EEEEE9]`, logo "🌱 Semear" à esquerda, avatar com dropdown (perfil/sair) à direita (reutilizar lógica do `AppHeader`)
- Main: `flex-1 overflow-y-auto pb-14` (padding bottom para não ficar sob a bottom nav)
- Bottom nav: `fixed bottom-0 w-full h-14 bg-white border-t`

### BottomNav
- Usa `useLocation` + `useNavigate` para controlar aba ativa
- 5 itens em flex row, cada um com `min-w-[44px] min-h-[44px]`
- Ícones Lucide: `Home`, `Users`, `CalendarDays`, `FolderOpen`, `Repeat`
- Cor ativa: `text-[#4F46E5]`, inativa: `text-[#94A3B8]`
- Label: `text-[10px]`

### Rotas no App.tsx
```text
/app/* → ProtectedRoute > AppShellV2
  /app/feed → FeedPage
  /app/people → PeoplePage
  /app/agenda → AgendaPage
  /app/projects → ProjectsPage
  /app/rituals → RitualsPage
  /app/profile → Profile (existente)
  /app/task/:id → TaskDetailPage
  /app/project/:id → ProjectDetailPage
  /app/ritual/:id → RitualDetailPage

/ → Navigate to /app/feed
/dashboard, /teams, /perfil → mantidos no AppLayout antigo
```

### Placeholders
Cada página placeholder: ícone Lucide grande (48px, cinza), texto "Em construção" centralizado vertical e horizontal, fundo `#FAFAF8`.

## O que NÃO muda
- `AppLayout`, `AppSidebar`, `AppHeader`, componentes de calendário — intactos
- Auth, hooks, schema — intocados
- Rotas `/dashboard`, `/teams`, `/perfil` continuam funcionando

