
# Plano v9 — Equipe dropdown, exclusão completa de usuário, e-mail no edit

## 1. Dropdown de Equipe nos cards de usuário
Trocar `<Input>` livre por `<Select>` com `TEAM_NAMES` (Equipe A–E) + opção "Sem equipe":
- `src/pages/AdminUsuarios.tsx` → `FormFields` (campo Equipe)
- `src/pages/Perfil.tsx` → seção "Meus Dados" (campo Equipe)

Importar `TEAM_NAMES` de `@/components/shift/shiftConstants`.

## 2. Campo E-mail no edit de usuário
Hoje `FormFields` recebe `includeEmail={editing?.source === "operational"}`. Para perfis com login (`source === "profile"`), o e-mail nunca aparece.

**Fix**: sempre exibir o campo no edit, mas em **read-only** quando `source === "profile"` (e-mail do Auth não é editável trivialmente). Carregar o e-mail do perfil via `auth.users` (precisa ser feito via edge function, pois o cliente não acessa `auth.users` diretamente).

**Solução simples**: ampliar `loadAll` para também buscar e-mails dos perfis usando uma nova edge function `admin-list-emails` (admin only, retorna `{user_id → email}`). Assim o campo aparece preenchido e bloqueado para edição em perfis, e editável para operacionais.

## 3. Botão Excluir para admin (todos os usuários, inclusive com login)
Hoje o ícone de lixeira só aparece para `source === "operational"`. Decisão do usuário: **excluir de vez**.

**Implementação**:
- Nova edge function `admin-delete-user` (admin-only):
  - Recebe `user_id`.
  - Bloqueia auto-exclusão (caller.id === user_id → 400).
  - `auth.admin.deleteUser(user_id)` — cascata limpa `profiles` e `user_roles` (FKs com `on delete cascade` no Auth; user_roles já tem FK para auth.users com cascade).
- No `AdminUsuarios.tsx`:
  - Mostrar `Trash2` para todos os membros.
  - Confirmar com `AlertDialog` antes (prevenir clique acidental — sem possibilidade de undo).
  - Para `source === "profile"` → invocar edge function.
  - Para `source === "operational"` → manter delete direto em `team_members`.
  - Bloquear botão de exclusão na própria linha do admin logado (`m.id === user.id`).

## 4. Bug menor (manutenção)
`shifts.iseo` legado vs `iseo_subteams`: já tratado em v6, sem mudança.

## Arquivos
**Novo**: `supabase/functions/admin-delete-user/index.ts`, `supabase/functions/admin-list-emails/index.ts`
**Editar**:
- `src/pages/AdminUsuarios.tsx` (Equipe dropdown no FormFields, e-mail sempre presente, delete universal com AlertDialog, fetch de e-mails)
- `src/pages/Perfil.tsx` (Equipe dropdown)

## Ordem
1. Edge function `admin-list-emails`
2. Edge function `admin-delete-user`
3. `FormFields`: Equipe → Select; e-mail sempre visível (readOnly se profile)
4. Tabela: Trash2 universal + AlertDialog + bloqueio auto-exclusão
5. `Perfil.tsx`: Equipe → Select
