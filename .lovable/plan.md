## Objetivo

Aplicar duas melhorias sem mexer na distribuição de ocorrência:

1. Melhorar a UX dos campos de horário usados na criação/edição/composição de plantão para trabalhar com horas inteiras (`10h`, `16h`, etc.), sem frações de hora.
2. No diálogo de continuação/registro de ocorrência, adicionar:
   - `Horário da finalização do BU`, com preenchimento automático a partir do PDF quando disponível
   - `Horário da 1ª oitiva`, preenchimento manual

---

## O que já existe hoje

- `CreateShiftDialog` usa `Input type="time"` para `startHour`.
- `EditShiftDialog` usa `Input type="time"` para `startHour` e `endHour`.
- `SubteamComposer` usa `Input type="time"` nas janelas de trabalho das subequipes.
- `OccurrencesTab` já possui os campos persistidos no tipo e no banco:
  - `final_time`
  - `first_hearing_time`
- `useShift.addOccurrence()` ainda **não mapeia** `final_time` e `first_hearing_time` no insert.
- A função `analyze-bo` ainda **não extrai** horário de finalização do BU.
- `RelatorioTriagem` ainda não tem um campo explícito para esse horário.

---

## Passo 1 — Padronizar seleção de horas inteiras nos fluxos de plantão

Criar um componente reutilizável, por exemplo `src/components/shift/HourSelect.tsx`, com estas características:

- opções fixas de `00:00` a `23:00`
- rótulo amigável no dropdown: `00h`, `01h`, `10h`, `16h`...
- valor interno mantido como `HH:00`
- compatível com o código atual que monta ISO usando `new Date(`${data}T${hora}:00`)`

Aplicações:

### 1.1 `src/components/shift/CreateShiftDialog.tsx`
Substituir o campo:
- `Horário de Início`

Por `HourSelect`, sem alterar a lógica de criação do plantão.

### 1.2 `src/components/shift/EditShiftDialog.tsx`
Substituir:
- `Horário de Início`
- `Horário de Término`

Também por `HourSelect`.

Como o estado hoje pode vir com minutos do banco (`10:30` etc.), normalizar os valores carregados para a hora cheia correspondente (`10:00`) ao popular `startHour` e `endHour`, para evitar inconsistência com o novo seletor.

### 1.3 `src/components/shift/SubteamComposer.tsx`
Substituir os `Input type="time"` das janelas por `HourSelect`, preservando:
- campos editáveis e não editáveis
- lógica atual de ISEO
- presets e janelas customizadas

Importante: isso vale para os horários da composição de plantão. Não mexer nos campos de distribuição de ocorrência.

---

## Passo 2 — Extrair o horário de finalização do BU a partir do PDF

Como você informou que o dado aparece **no final do PDF, logo após o campo “Fim da lavratura/Recebimento”**, o plano passa a incluir ajuste na extração.

### 2.1 Atualizar o contrato de dados
Em `src/types/analysis.ts`, adicionar ao `RelatorioTriagem` um novo campo opcional, por exemplo:

- `fim_lavratura_recebimento?: string`

Formato esperado:
- preferencialmente `HH:mm` quando a IA conseguir identificar com segurança
- vazio/ausente quando não conseguir extrair

### 2.2 Atualizar a Edge Function `supabase/functions/analyze-bo/index.ts`
Ajustar os prompts de triagem e análise completa para instruir explicitamente a IA a:

- procurar no final do PDF o campo **“Fim da lavratura/Recebimento”**
- extrair o horário imediatamente associado a esse campo
- devolver esse valor em `triagem.fim_lavratura_recebimento`
- retornar vazio se o campo não estiver legível ou não existir

Também atualizar o JSON esperado tanto no prompt de triagem quanto no prompt completo.

A lógica de pós-processamento da função deve continuar tolerante a ausência desse dado.

---

## Passo 3 — Persistir o horário automático na análise e usar no registro rápido

### 3.1 `src/hooks/useAnalysis.ts`
Não precisa de mudança estrutural grande: como `result` e `triageResult` já armazenam o JSON retornado pela análise, basta garantir que o novo campo do tipo seja refletido no TypeScript.

### 3.2 `src/pages/Index.tsx`
No fluxo de **Registro Rápido**:

- estender o estado `regForm` para incluir:
  - `first_hearing_time: string`
  - opcionalmente um valor visual para `final_time`, se o usuário puder revisar antes de enviar

- no resumo do dialog “Registrar Ocorrência”, exibir o horário extraído do PDF quando existir
- preencher automaticamente o valor de `final_time` com base em `result.triagem.fim_lavratura_recebimento`
- converter esse `HH:mm` para ISO usando a data do plantão (`shift.activeShift.shift_date`) no momento do `shift.addOccurrence()`

Manter o comportamento resiliente:
- se o PDF não trouxer esse horário, enviar `final_time: null`
- `first_hearing_time` permanece manual

---

## Passo 4 — Adicionar os campos no diálogo “Continuar Atendimento”

Arquivo: `src/components/shift/OccurrencesTab.tsx`

### 4.1 Estado inicial
Em `emptyForm()`, incluir:
- `final_time: null`
- `first_hearing_time: null`

### 4.2 Conversão entre input e ISO
Adicionar helper local para converter `HH:mm` em ISO com base em `shift.shift_date`, reutilizando a lógica já existente de `isoToTimeInput`.

Exemplo de comportamento:
- input vazio → `null`
- `14:30` → `new Date(`${shift.shift_date}T14:30:00`).toISOString()`

### 4.3 UI do diálogo
No formulário do modal de ocorrência, quando estiver em contexto de continuidade/edição da ocorrência:

- adicionar campo `Horário da 1ª Oitiva`
- adicionar campo `Horário da Finalização`

Esses campos devem usar `Input type="time"`, porque aqui faz sentido manter precisão por minuto.

Isso não conflita com o pedido de “horas inteiras”, porque esse pedido foi especificamente para os horários de criação/composição de plantão — e você pediu para não mexer na distribuição de ocorrência.

### 4.4 Pré-preenchimento
Quando a ocorrência já tiver `final_time` ou `first_hearing_time`, mostrar os valores existentes.

Quando a ocorrência vier do fluxo de Registro Rápido e já tiver `final_time` extraído do PDF, o campo deve abrir preenchido automaticamente.

---

## Passo 5 — Garantir persistência desses campos nas ocorrências

Arquivo: `src/hooks/useShift.ts`

### 5.1 Insert
Atualizar `addOccurrence()` para incluir no insert:
- `final_time: occ.final_time || null`
- `first_hearing_time: occ.first_hearing_time || null`

### 5.2 Update
`updateOccurrence()` já faz `update(updates)` genérico, então tende a funcionar sem ajuste estrutural.

---

## Arquivos previstos

- `src/components/shift/HourSelect.tsx` (novo)
- `src/components/shift/CreateShiftDialog.tsx`
- `src/components/shift/EditShiftDialog.tsx`
- `src/components/shift/SubteamComposer.tsx`
- `src/components/shift/OccurrencesTab.tsx`
- `src/pages/Index.tsx`
- `src/types/analysis.ts`
- `src/hooks/useShift.ts`
- `supabase/functions/analyze-bo/index.ts`

---

## Restrições respeitadas

- Não alterar a lógica do campo de distribuição de ocorrência.
- Não alterar a lógica do plantão ativo em si.
- Não criar migration, porque `final_time` e `first_hearing_time` já existem na tabela `shift_occurrences`.
- Manter o preenchimento automático do horário de finalização como opcional/fallback seguro: só preenche quando a extração do PDF trouxer um valor confiável.

---

## Resultado esperado

- Criação/edição/composição de plantão ficam mais rápidas e menos sujeitas a erro com seleção por hora cheia.
- O sistema passa a capturar do PDF o horário de **Fim da lavratura/Recebimento**.
- Esse horário entra automaticamente no registro da ocorrência quando disponível.
- O usuário pode completar manualmente a **1ª oitiva** e ajustar a **finalização** no diálogo de continuação, sem mudar o fluxo de distribuição.