
# Plano v8 — Dropdown de Equipe na criação

## Investigação
`CreateShiftDialog.tsx` (linhas 95-107) já tem `Select` com `TEAM_NAMES`. Importa de `./shiftConstants` — arquivo existe e exporta `TEAM_NAMES = ["Equipe A"..."Equipe E"]`.

Hipóteses do "não foi implementado":
1. Há outro fluxo de criação (não o `CreateShiftDialog`) onde a equipe ainda é input livre.
2. O Select renderiza mas o usuário esperava ver as opções em outro lugar (ex.: ShiftSelector ao trocar de plantão).
3. Cache do navegador exibindo versão antiga.

## Verificação necessária
Buscar todos os pontos de criação/edição de plantão e qualquer input de `team_name` que ainda seja `<Input>` em vez de `<Select>`:
- `Plantao.tsx` (botão "Novo Plantão" → abre `CreateShiftDialog` ✓)
- Estado vazio "nenhum plantão ativo" (também abre `CreateShiftDialog` ✓)
- `useShift.createShift` — só recebe `team_name` string, sem UI própria
- `ShiftSelector.tsx` — apenas listagem, sem criação

## Ação
1. Confirmar via `code--search_files` que não existe `<Input ... team_name` ou `placeholder="Equipe"` solto.
2. Se existir → trocar por `Select` com `TEAM_NAMES`.
3. Se não existir → o dropdown JÁ está implementado; orientar usuário a hard-refresh (Ctrl+Shift+R) e indicar exatamente onde fica (primeiro campo do dialog "Novo Plantão", rótulo "Equipe").

## Arquivos potencialmente afetados
- `src/components/shift/CreateShiftDialog.tsx` (já OK — confirmar)
- `src/components/shift/EditShiftDialog.tsx` (já OK — confirmar)
- Qualquer outro local descoberto na busca

## Ordem
1. Buscar inputs livres de equipe restantes
2. Substituir por dropdown se houver
3. Caso contrário, comunicar que está implementado + sugerir refresh
