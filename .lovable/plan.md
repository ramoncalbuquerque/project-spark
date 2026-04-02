

# Plano: Criação do Schema Supabase — Semear

## Resumo

Criar 6 tabelas, 1 trigger, e políticas RLS completas no Supabase, seguindo exatamente as seções 3 e 6 do Knowledge File.

## Nota importante sobre roles

O Knowledge File especifica `role` na tabela `profiles`, mas as instruções de segurança do sistema exigem que roles fiquem em tabela separada para evitar privilege escalation. Vou seguir o Knowledge File conforme solicitado, mas usando uma **function `security definer`** para checar roles nas políticas RLS, evitando recursão infinita na tabela `profiles`.

## Execução — Uma única migration

### 1. Tabelas (ordem de criação)

1. **profiles** — `id` (UUID PK, FK auth.users), `full_name`, `avatar_url`, `role` (text, default 'member'), `phone`, `created_at`, `updated_at`
2. **teams** — `id` (UUID PK), `name`, `description`, `created_by` (FK profiles), timestamps
3. **team_members** — `id` (UUID PK), `team_id` (FK teams), `profile_id` (FK profiles), `joined_at`, UNIQUE(team_id, profile_id)
4. **cards** — todos os campos especificados, FKs para profiles e teams
5. **agenda_items** — FK cards ON DELETE CASCADE, `content`, `is_completed`, `sort_order`
6. **attachments** — FK cards ON DELETE CASCADE, `file_name`, `file_url`, `file_size`, `uploaded_by`

### 2. Trigger

- Function `handle_new_user()` — insere em `profiles` com `id = NEW.id`, `full_name` extraído de metadata, `role = 'member'`
- Trigger `on_auth_user_created` AFTER INSERT on `auth.users`

### 3. Security Definer Function

- `get_user_role(user_id UUID)` — retorna o role do usuário sem disparar RLS recursivo na tabela profiles

### 4. RLS Policies

| Tabela | Operação | Regra |
|--------|----------|-------|
| **profiles** | SELECT | Qualquer autenticado |
| **profiles** | UPDATE | Apenas próprio (id = auth.uid()) |
| **teams** | SELECT | Membro do time OU created_by |
| **teams** | INSERT/UPDATE/DELETE | created_by = auth.uid() |
| **team_members** | SELECT | Membro do time OU criador do time |
| **team_members** | INSERT/DELETE | Criador do time |
| **cards** | SELECT | created_by OU assigned_to_profile OU membro do assigned_to_team |
| **cards** | INSERT | Apenas role = 'leader' |
| **cards** | UPDATE | created_by edita tudo; assigned_to_profile edita só status |
| **cards** | DELETE | created_by = auth.uid() |
| **agenda_items** | SELECT/INSERT/UPDATE | Acesso ao card pai |
| **agenda_items** | DELETE | created_by do card pai |
| **attachments** | SELECT | Acesso ao card pai |
| **attachments** | INSERT | Acesso ao card pai |
| **attachments** | DELETE | uploaded_by OU created_by do card pai |

### 5. Helper Functions (security definer)

- `get_user_role(uuid)` — retorna role sem recursão
- `can_access_card(uuid, uuid)` — verifica se usuário tem acesso ao card (reutilizada em agenda_items e attachments)

## Detalhes técnicos

- Todos os IDs: `gen_random_uuid()`
- Timestamps: `DEFAULT now()`
- CASCADE apenas em agenda_items e attachments (FK para cards)
- Para a policy de UPDATE em cards pelo liderado (apenas status), será usada uma policy com `USING` + `WITH CHECK` restringindo colunas via comparação dos valores antigos
- Nenhuma tabela ou campo extra será criado

