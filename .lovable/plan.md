
# Plano final ajustado — pronto para implementação

## Ajustes desta rodada
- **Máscara NF**: apenas filtro `replace(/\D/g, '')` (somente dígitos), sem limite de tamanho fixo. Aceita 6, 7+ dígitos. Placeholder: `123456`.
- **Nome completo na tabela de membros (`AdminUsuarios`)**: coluna principal é o **Nome completo**, com o **Apelido** exibido como subtítulo/coluna ao lado.
- **Uso otimizado em tela**: fila de distribuição (`OccurrencesTab`) e estatísticas (`StatisticsTab`) usam **`nickname || full_name`** (apelido quando existir, fallback para nome completo).
- **Exportações (`exportDocx`, `exportXlsx`)**: sempre usam **nome completo + NF** — nunca apelido. A PO mantém formalidade.

## Resumo das máscaras (`src/lib/masks.ts`)
- `maskPhone(v)` → `(##) #####-####` — placeholder `(27) 99999-9999`
- `maskNF(v)` → apenas dígitos, sem limite — placeholder `123456`
- E-mail: validação por regex no submit (sem máscara) — placeholder `usuario@pc.es.gov.br`

## Etapas (sem mudanças estruturais — só refino)

1. **Migração** — colunas em `profiles` e `team_members`:
   - `team_members`: `nickname`, `email`, `telefone`, `lotacao`, `equipe`
   - `profiles`: `nickname`, `telefone`, `lotacao`, `equipe`, `signature_style` (jsonb)
   - `lotacao` default `'Central de Teleflagrante'`

2. **Domínio `@pc.es.gov.br`** em `signup`, `admin-create-user`, `Auth.tsx`.

3. **`AdminUsuarios.tsx` unificado** — uma tabela única com colunas: **Nome completo** | Apelido | NF | Cargo | Lotação | Equipe | Permissão (só para quem tem login) | Ações.

4. **Apelido em fila e estatísticas** — `OccurrencesTab`, `StatisticsTab`, `MemberSelector`, `useTeamMembers` adotam `nickname || full_name`.

5. **Exportações preservam nome completo** — verificar `exportDocx.ts` e `exportXlsx.ts`: continuar usando `full_name` + `nf` (não trocar por apelido).

6. **Página `/perfil`** — Meus Dados (com máscaras) + Agente IA (instruções para leigos, placeholders genéricos).

7. **Integração IA** — `useAnalysis` envia `signature_style`; `analyze-bo` injeta no prompt.

## Auditoria
`created_by` + `created_at` já cobrem o log básico. Sem ação adicional.

## Arquivos
- **Migração**: nova
- **Criar**: `src/lib/masks.ts`, `src/lib/constants.ts`, `src/hooks/useProfile.ts`, `src/pages/Perfil.tsx`
- **Editar**: `signup`, `admin-create-user`, `analyze-bo`, `Auth.tsx`, `AdminUsuarios.tsx`, `App.tsx`, `AppSidebar.tsx`, `useTeamMembers.ts`, `OccurrencesTab.tsx`, `StatisticsTab.tsx`, `MemberSelector.tsx`, `useAnalysis.ts`
- **Verificar (sem alterar lógica)**: `exportDocx.ts`, `exportXlsx.ts` — confirmar que usam `full_name`

## Comando final
Responda **"Aprovado, implementar tudo"** (ou clique no botão) para sair do modo plano e iniciar pela migração.
