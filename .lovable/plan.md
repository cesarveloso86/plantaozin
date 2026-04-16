
# Plano de correções e melhorias (revisado)

## 1. Edição granular de depoimentos
- `AnalysisResult.tsx`: botão **"Corrigir"** em cada Card de depoimento (ao lado do CopyButton).
- `useAnalysis.reanalyze(instructions, field, depoimentoIndex?)` — atualiza apenas o item.
- `analyze-bo`: aceita `field=depoimento` + `depoimento_index` e regenera somente aquele.

## 2. Observações administrativas — editar/excluir
- `ResumoTab.tsx`: ícones `Edit` (Textarea inline) e `Trash` por item.
- `useShift`: `updateObservation(idx, text)` e `deleteObservation(idx)`.

## 3 + 4. Fila preditiva por subequipes com horários fixos

**Presets de turno** (`src/components/shift/scheduleConstants.ts`):
- **Turno 1**: 10:00–16:00 · descanso 16:00–21:00 · retorno 21:00–04:00
- **Turno 2**: 16:00–23:00 · descanso 23:00–04:00 · retorno 04:00–10:00
- **ISEO**: janela única, sem descanso (definida ao adicionar)

**Modelo**:
- `ShiftMember.schedule = { preset: 'T1' | 'T2' | 'ISEO' | 'CUSTOM', windows: [{start,end}, {start,end}?] }`
- `MemberSelector`: dropdown de preset ao adicionar (CUSTOM permite editar manualmente).

**Lógica** (`src/lib/availability.ts`):
- `isAvailable(member, dateTime)` — checa se hora atual cai dentro de alguma janela.
- `getAvailableMembers(members, dateTime)` — lista quem está ativo agora.
- `predictQueue(available, occurrences, pending, count=N)` — round-robin **ponderado por menor carga** entre os disponíveis. Retorna ordem prevista dos próximos N atendimentos.

**Reorganização da UI** (`OccurrencesTab.tsx`):
- Sub-abas internas:
  - **Em Distribuição** — fila preditiva (próximos N), pendentes e form de adicionar.
  - **Já Atendidas** — tabela das registradas (saem da aba anterior ao salvar).
- Skip individualizado: dois botões (`Pular OIP` / `Pular Autoridade`) por item.

**Correção de cargo**:
- Atualizar os 20 membros de teste: todos viram `cargo='OIP'`.

## 5. Regional automática a partir do BU
- `analyze-bo` (prompt): retornar `unidade_registro` (texto literal) + `regional_codigo` (uma das 18 ou DEACLE). Se não casar, adiciona alerta automático: *"Unidade de Registro fora da lista oficial — verifique o BU"*.
- `RelatorioTriagem` ganha `unidade_registro?` e `regional_codigo?`.
- `Index.tsx > handleSendToShift`: usa `regional_codigo`; fallback por palavra-chave; se vazio, toast de aviso.

## 6. Exportação XLSX — ordem de atendimento + segundos
- `exportXlsx.ts`: ordenar por `tramitation_time ASC`; formatar horários como `HH:mm:ss`.
- Inputs `time` com `step="1"` no form.

## Arquivos
**Criar**: `src/lib/availability.ts`, `src/components/shift/scheduleConstants.ts`
**Editar**: `src/types/shift.ts`, `src/types/analysis.ts`, `AnalysisResult.tsx`, `ResumoTab.tsx`, `OccurrencesTab.tsx`, `MemberSelector.tsx`, `CreateShiftDialog.tsx`, `EditShiftDialog.tsx`, `useShift.ts`, `useAnalysis.ts`, `exportXlsx.ts`, `Index.tsx`, `analyze-bo/index.ts`
**Dados**: UPDATE em `team_members` para `cargo='OIP'` nos 20 de teste.

## Comando final
Responda **"Aprovado, implementar"** para começar pelos types/schedule e fila preditiva.
