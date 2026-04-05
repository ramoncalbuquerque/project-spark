

# Migração do Schema — Semear v2

## Visão geral

Uma única migração SQL que: altera 3 tabelas existentes (profiles, cards, teams), cria 7 novas tabelas, adiciona 2 funções SECURITY DEFINER e aplica RLS em todas as novas tabelas.

## Migração SQL

### Parte 1 — Alterar tabelas existentes

**profiles**: adicionar `department TEXT`, `position TEXT`, `superior_id UUID REFERENCES profiles(id)`, `hierarchy_level TEXT` com validação via trigger (não CHECK, pois é boa prática).

**teams**: adicionar `department TEXT`, `is_org_unit BOOLEAN DEFAULT false`.

**projects** e **ritual_occurrences** precisam existir antes de alterar cards, então a ordem será:

1. Criar `projects` e `rituals` primeiro
2. Criar `ritual_occurrences`
3. Alterar `cards` com FKs para `projects` e `ritual_occurrences`

### Parte 2 — Novas tabelas (em ordem de FK)

| Tabela | Colunas principais | Notas |
|--------|-------------------|-------|
| `projects` | id, name, description, status DEFAULT 'active', created_by FK profiles, timestamps | Base para agrupamento |
| `project_members` | id, project_id FK CASCADE, profile_id FK CASCADE, role DEFAULT 'member', joined_at | UNIQUE(project_id, profile_id) |
| `rituals` | id, name, description, frequency TEXT, created_by FK profiles, timestamps | Cadências recorrentes |
| `ritual_members` | id, ritual_id FK CASCADE, profile_id FK CASCADE | UNIQUE(ritual_id, profile_id) |
| `ritual_occurrences` | id, ritual_id FK CASCADE, date TIMESTAMPTZ NOT NULL, notes TEXT, status DEFAULT 'open', created_by FK profiles, created_at | Cada "sessão" |
| `task_history` | id, card_id FK CASCADE, ritual_occurrence_id FK ritual_occurrences, status_at_time TEXT, context_note TEXT, updated_by FK profiles, created_at | Histórico por ocorrência |
| `contacts` | id, full_name NOT NULL, phone NOT NULL, department, position, created_by FK profiles, linked_profile_id FK profiles NULL, created_at | Contatos sem conta |

Depois de criar projects e ritual_occurrences:

**cards**: adicionar `project_id UUID REFERENCES projects(id) ON DELETE SET NULL`, `ritual_occurrence_id UUID REFERENCES ritual_occurrences(id) ON DELETE SET NULL`, `origin_type TEXT DEFAULT 'standalone'` com validação via trigger.

### Parte 3 — Funções SECURITY DEFINER

```text
is_project_member(project_id, user_id) → boolean
  SELECT EXISTS (SELECT 1 FROM project_members WHERE ...)

is_ritual_member(ritual_id, user_id) → boolean
  SELECT EXISTS (SELECT 1 FROM ritual_members WHERE ...)
```

### Parte 4 — RLS Policies

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| projects | `is_project_member OR created_by` | `leader only` | `created_by` | `created_by` |
| project_members | `is_project_member` | `is_project_creator` | — | `is_project_creator` |
| rituals | `is_ritual_member OR created_by` | `leader only` | `created_by` | `created_by` |
| ritual_members | `is_ritual_member OR created_by` | `created_by of ritual` | — | `created_by of ritual` |
| ritual_occurrences | `is_ritual_member` | `authenticated + is_ritual_member` | `is_ritual_member` | `created_by of ritual` |
| task_history | `can_access_card` | `authenticated + can_access_card` | — | — |
| contacts | leaders only (all ops) | leaders only | leaders only | leaders only |

### Parte 5 — Triggers updated_at

Aplicar `update_updated_at_column()` (já existe) em: `projects`, `rituals`.

### Validações via trigger (não CHECK)

- `profiles.hierarchy_level`: trigger BEFORE INSERT/UPDATE valida IN ('alto','medio','baixo', NULL)
- `cards.origin_type`: trigger BEFORE INSERT/UPDATE valida IN ('standalone','project','ritual','meeting')

## O que NÃO será alterado

- Nenhum arquivo React/TypeScript
- Nenhuma tabela existente terá colunas removidas
- RLS existente permanece intacta
- Funções helper existentes permanecem

## Resultado

Após a migração, os tipos TypeScript serão regenerados automaticamente pelo sistema, refletindo as novas tabelas e campos.

