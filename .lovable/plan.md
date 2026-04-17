
# Plano v7 — Ajustes finos

## 1. Bug data -1 no export DOCX
`exportDocx.ts` linha 4: `new Date(shift.shift_date)` interpreta `YYYY-MM-DD` como UTC → -3h vira dia anterior. `end_time` é timestamp completo, por isso correto.
**Fix**: usar `parseLocalDate` de `src/lib/utils.ts` (já existe) para `shift_date`.

## 2. Equipe via dropdown na criação
`CreateShiftDialog.tsx` já tem `Select` com `TEAM_NAMES` importado de `./shiftConstants`. Verificar se está renderizando — está. **Nada a fazer** salvo se o usuário se referir a `EditShiftDialog`. Conferir lá também e padronizar.

## 3. Ordem dos blocos na criação: Delegado → OIP → ISEO
`CreateShiftDialog.tsx` e `EditShiftDialog.tsx`: hoje é OIP → Delegado → ISEO. Reordenar JSX dos `SubteamComposer`.

## 4. Tabela de usuários em ordem alfabética
`AdminUsuarios.tsx`: ordenar lista de membros por `full_name` (locale pt-BR, case-insensitive) antes de renderizar. Aplicar a ambas listas (team_members + auth users) se houver.

## 5. Campo e-mail no edit de usuário
Já implementado em v6 (FormFields extraído). Confirmar que está visível no modo "edit" — se sim, desconsiderar; se não, adicionar `<Input type="email">` ao `FormFields` quando `mode === 'edit'` (read-only, pois Auth não permite trocar email trivialmente).

## Arquivos
- `src/lib/exportDocx.ts` — usar `parseLocalDate(shift.shift_date)`
- `src/components/shift/CreateShiftDialog.tsx` — reordenar para Delegado/OIP/ISEO
- `src/components/shift/EditShiftDialog.tsx` — reordenar idem; conferir dropdown de equipe
- `src/pages/AdminUsuarios.tsx` — sort alfabético; conferir campo email no form

## Ordem
1. Fix data DOCX
2. Reordenar dialogs (Delegado → OIP → ISEO)
3. Sort alfabético na tabela
4. Conferir/garantir campo email no edit
