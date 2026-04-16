
# Plano v3 — adendos solicitados

## A. Skip vai para o final da fila (bug)
**Hoje** `nextSkipping` retorna o próximo da lista circular → quem pulou pode reaparecer em 1º.
**Fix** em `src/lib/availability.ts`:
- `predictQueue` aceita `skipped: string[]` — exclui da rotação atual e os recoloca **no fim** da ordem prevista.
- `OccurrencesTab`: estado `skippedInv: string[]` / `skippedAuth: string[]` por slot pendente. Botão "Pular" empurra o nome para o fim em vez de avançar para o vizinho.
- Reset do skip ao concluir/registrar a ocorrência.
- (Futuro: regra por equipe — deixar gancho `getSkipPolicy(team)`.)

## B. Contador `+` / `-` de oitivas no dialog de edição
Em `OccurrencesTab` (dialog de criação/edição):
- Substituir `<Input type="number">` de `num_hearings` pelo mesmo controle inline `[ - ] N [ + ]` já usado na tabela "Já Atendidas".
- Min = 0, sem máximo. Atualiza `form.num_hearings` direto.

## C. Observações não devem herdar "fatos"
**Hoje** `Index.tsx > handleSendToShift` provavelmente preenche `observations` com `result.fatos` (ou similar).
**Fix**:
- Não popular `observations` ao enviar para o plantão. Campo começa **vazio** — usuário preenche manualmente se quiser.
- Conferir/remover qualquer atribuição automática a `observations` no payload de `addOccurrence`.

## D. Data exibida com -1 (timezone)
**Causa** `shift_date` é `date` (sem hora) — ao criar `new Date("2026-04-16")` o JS interpreta UTC e converte para local (UTC-3 → dia anterior).
**Fix**:
- Em `CreateShiftDialog` ao salvar: usar `format(date, "yyyy-MM-dd")` do `date-fns` (já importado) — sem `toISOString()`.
- Em qualquer exibição (`Plantao.tsx`, headers de tabs): parsear como local com `parseISO` + `format` ou compor manualmente `new Date(y, m-1, d)`. Nunca `new Date(shift_date)` direto.

## E. Bloquear BU duplicado
Validação em `OccurrencesTab` antes de adicionar à fila pendente, registrar manualmente, ou salvar via `Index.tsx > handleSendToShift`:
- Normalizar `bu_number` (trim, upper).
- Procurar em `occurrences` (qualquer status) + `pendingQueue`.
- Se existir: `toast.error("BU XXXX já está na distribuição/atendida")` e abortar.
- Em `handleSendToShift`: mesma checagem antes do `addOccurrence`; se duplicado, retornar toast informando o status atual.

## Arquivos
- `src/lib/availability.ts` — `predictQueue(..., skipped)`, helper de skip-to-end
- `src/components/shift/OccurrencesTab.tsx` — estado de skip por slot, contador `+/-` no dialog, validação de BU duplicado
- `src/pages/Index.tsx` — não popular `observations`; checar duplicidade antes de enviar
- `src/components/shift/CreateShiftDialog.tsx` — salvar `shift_date` sem UTC
- `src/pages/Plantao.tsx` — formatar `shift_date` como local
- (eventualmente) `src/components/shift/ResumoTab.tsx` se exibir data
