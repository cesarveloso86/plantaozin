
# Plano v6 — Ajustes de presets, ISEO e bugs

## 1. Preset OIP "C" (coringa) → 16:00–04:00
`scheduleConstants.ts` > `OIP_PRESETS`:
- Atualizar preset C: `windows: [{ start: "16:00", end: "04:00" }]`, descrição `"16:00–04:00 (coringa)"`.

## 2. ISEO com início configurável (8h fixas)
ISEO = Indenização Suplementar de Escala Operacional. Duração fixa de 8h, início escolhido pelo operador (06:00, 16:00, 18:00, ou custom).

### Alterações
- `scheduleConstants.ts`: adicionar `ISEO_PRESETS`:
  - `ISEO_06`: 06:00–14:00
  - `ISEO_16`: 16:00–00:00
  - `ISEO_18`: 18:00–02:00
  - `CUSTOM`: operador define início (end = start + 8h calculado automaticamente).
- `SubteamComposer.tsx`: ao receber `category="ISEO"`, mostrar selector de preset (06h/16h/18h/Custom). Em Custom, apenas input de horário inicial; janela final é derivada (+8h).
- `Create/EditShiftDialog.tsx`: ISEO deixa de ser selector plano de membros e passa a ser um `SubteamComposer` da categoria ISEO (mesma UX de OIP/Delegado), permitindo múltiplas subequipes ISEO com horários diferentes. Filtro de cargo continua aberto (todos cargos).
- `types/shift.ts`: adicionar `iseo_subteams: ShiftSubteam[]` em `Shift`. `category` aceita `"OIP" | "Delegado" | "ISEO"`.
- Migration: `ALTER TABLE shifts ADD COLUMN iseo_subteams jsonb NOT NULL DEFAULT '[]'`.
- `useShift.ts`: persistir/ler `iseo_subteams`; flatten para `iseo` (compat).
- `availability.ts > predictSubteamQueue`: já é genérica por categoria — incluir ISEO no cálculo de janelas ativas.
- `ResumoTab.tsx`: nova seção "ISEO" listando subequipes.

## 3. Bug: edição de usuário perde foco a cada tecla
**Causa**: em `AdminUsuarios.tsx`, o componente `FormFields` é declarado **dentro** do componente `AdminUsuarios` → re-renderiza a cada `setState` → React desmonta/remonta os Inputs → foco perdido.

**Fix**: extrair `FormFields` para fora do componente (top-level no arquivo, ou arquivo separado), recebendo `form`, `setForm`, e flags via props. Sem mudança de comportamento, apenas estrutura.

## 4. Dois perfis para o mesmo usuário (Cesar admin + Cesar analista)
**Limitação**: o Supabase Auth identifica usuários por e-mail único. Não dá para ter 2 perfis com o mesmo e-mail.

**Solução prática**: criar uma 2ª conta com e-mail institucional alternativo (ex.: `cesar.alt@pc.es.gov.br` ou outro endereço válido `@pc.es.gov.br`) e atribuir role `analista`. A conta existente `cesar@…` mantém role `admin`.

Como executar (sem código novo — usa o fluxo já existente em `/admin/usuarios`):
1. Logar como admin.
2. Em `/admin/usuarios` → "Adicionar membro" → marcar "Criar com acesso ao sistema".
3. Preencher e-mail alternativo, mesmo nome, mesma NF (ou variar se necessário), cargo etc.
4. Salvar — a role default `analista` é atribuída automaticamente pelo trigger.
5. Para alternar perfis: logout e login com o e-mail correspondente.

**Não recomendo** "switch de role" no mesmo login — quebra o modelo de auditoria (created_by, RLS) e abre vetor de escalonamento de privilégios. Vou apenas explicar isso na resposta, sem mudança de código no item 4.

## Arquivos
**Migration**: `shifts.iseo_subteams jsonb`
**Editar**:
- `src/components/shift/scheduleConstants.ts` (preset C OIP + ISEO_PRESETS + helper para ISEO custom)
- `src/components/shift/SubteamComposer.tsx` (suporte categoria ISEO com presets de início)
- `src/components/shift/CreateShiftDialog.tsx` + `EditShiftDialog.tsx` (ISEO via SubteamComposer)
- `src/types/shift.ts` (`iseo_subteams`, category ISEO)
- `src/hooks/useShift.ts` (persist/load + flatten compat)
- `src/lib/availability.ts` (incluir ISEO em predictSubteamQueue se aplicável)
- `src/components/shift/ResumoTab.tsx` (seção ISEO)
- `src/pages/AdminUsuarios.tsx` (extrair `FormFields` para fora do componente)

## Ordem
1. Migration `iseo_subteams`
2. `scheduleConstants` (C coringa + ISEO_PRESETS)
3. `SubteamComposer` + dialogs (ISEO como subequipe)
4. `useShift` + `availability` + `ResumoTab`
5. Fix do bug de foco em `AdminUsuarios`
