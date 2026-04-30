## Diagnóstico

1. **Erro ao confirmar em "Sem Oitiva"**: a tabela `shift_occurrences` tem um CHECK constraint antigo:
   ```
   CHECK (status = ANY (ARRAY['em_atendimento', 'atendida']))
   ```
   Quando o `addToQueueSO` envia `status: "sem_oitiva"`, o Postgres rejeita o INSERT. Por isso o botão Confirmar falha. Precisa migration para liberar o terceiro valor.

2. **Fila preditiva**: hoje o código pede `count=5` em `predictSubteamQueue` / `predictQueue` e renderiza apenas 1 linha de input + 3 slots-preview (`predictedInv.slice(1,4)`). O usuário quer 10 slots pré-preenchidos.

3. **Exportação**: `exportShiftXlsx` filtra `status !== "em_atendimento"` (já inclui `sem_oitiva` e `atendida`). `exportPODocx` recebe todas as ocorrências, mas `ResumoTab` (prévia da PO) já filtra somente `atendida`. Para garantir que Sem Oitiva vire registro oficial sem precisar de oitiva real, a UI de "Confirmar" da aba Sem Oitiva passará a gravar **direto como `atendida`** (mesmo comportamento de "atendida" para fins de relatório), com BU + servidores escolhidos. Isso atende ao requisito: "Não precisam entrar na fila em atendimento. Podem entrar em Já Atendidas após preenchimento."

4. **Dropdown na linha de confirmação**: hoje os nomes dos servidores na linha "Próximo" são apenas texto. Trocar por `<Select>` editável (mantendo a sugestão como valor padrão) tanto na aba Em Distribuição quanto na Sem Oitiva.

## Plano

### Migration (Lovable Cloud)
Substituir o CHECK constraint da tabela `shift_occurrences` para permitir os três valores:

```sql
ALTER TABLE public.shift_occurrences DROP CONSTRAINT shift_occurrences_status_check;
ALTER TABLE public.shift_occurrences ADD CONSTRAINT shift_occurrences_status_check
  CHECK (status IN ('em_atendimento','atendida','sem_oitiva'));
```

### `src/components/shift/OccurrencesTab.tsx`

- Aumentar a fila preditiva para 10 slots:
  - Trocar `predictSubteamQueue(..., 5, ...)` → `..., 10, ...` em `predictedInvSub`, `predictedAuthSub`, `predictedInvSubSO`, `predictedAuthSubSO`.
  - O mesmo para os fallbacks `predictQueue(..., 5, ...)` → `10`.
  - Renderizar `predictedInv.slice(1, 10)` em vez de `slice(1, 4)` (e idem para SO).

- **Linha "Próximo" (Em Distribuição e Sem Oitiva)**: substituir as células de OIP/Autoridade (texto puro) por `<Select>` controlado por estado local (`pickInv`, `pickAuth`, `pickInvSO`, `pickAuthSO`), inicializado com `suggestedInvestigator` / `suggestedAuthority`. Quando a sugestão muda (porque a fila recalculou) e o usuário não editou manualmente, o pick segue a sugestão; ao editar, fixa a escolha até confirmar.
  - Reset desses picks ao terminar `addToQueue`/`addToQueueSO` para que voltem a seguir a sugestão.

- **`addToQueueSO`**: gravar a ocorrência **direto como `status: "atendida"`** (não como `sem_oitiva`), preservando BU, hora, OIP e Autoridade escolhidos. Assim, ela aparece imediatamente em "Já Atendidas" e entra naturalmente na PO (DOCX) e na planilha (XLSX). Manter o nome da aba "Sem Oitiva" e o card como espaço de **registro rápido** desses procedimentos.

- **Aba Sem Oitiva — listagem das ocorrências existentes**: como agora elas viram `atendida`, a aba não precisa mais listá-las (ficam em "Já Atendidas"). Manter a aba apenas com a tabela de entrada (10 slots de fila preditiva + linha de confirmação). O contador na TabsTrigger pode ficar em 0 ou ser removido — seguiremos exibindo só o título "Sem Oitiva" sem contador.
  - Remover dependência do tipo `sem_oitiva` no filtro `semOitiva` (não vai mais existir no banco para casos novos). Para legado: manter o filtro só para retrocompatibilidade visual, escondendo a seção se vazio.

- **Fila preditiva da aba Sem Oitiva**: como agora as ocorrências entram como `atendida`, a fila independente passa a contar a carga apenas dessas atendidas marcadas como sem-oitiva. Para distinguir sem mudar schema, registrar `po_status` ou `observations` não é confiável. Solução simples: a aba Sem Oitiva usa **a mesma lista de subequipes** mas mantém uma fila própria considerando todas as ocorrências do plantão (em atendimento + atendidas), distribuindo de forma independente do card "Em Atendimento". O usuário pode trocar via dropdown qualquer servidor antes de confirmar.

  Como cada confirmação aumenta a carga real (atendida), a fila se reequilibra organicamente sem precisar de campo extra.

### `src/types/shift.ts`
Manter `sem_oitiva` no enum por compatibilidade com dados legados, mas o fluxo novo não cria mais esse status.

### Sem mudanças
- `src/lib/exportDocx.ts` e `src/lib/exportXlsx.ts` — já filtram corretamente (`atendida` entra).
- `src/components/shift/ResumoTab.tsx` e `StatisticsTab.tsx` — já contam `atendida`.
- `src/pages/Plantao.tsx` — header já cobre os três status.

## Resumo dos arquivos

```text
supabase migration                              — relaxar CHECK status (sem_oitiva permitido por compat.)
src/components/shift/OccurrencesTab.tsx         — 10 slots, Select editável na linha de confirmação,
                                                  Sem Oitiva grava direto como atendida
```

Sem alterações em hooks, edge functions, tipos do banco ou exports.
