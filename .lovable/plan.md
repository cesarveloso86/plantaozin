## Plano

### 1. Fila preditiva como tabela compacta (estilo planilha)

Em `src/components/shift/OccurrencesTab.tsx` (aba "Em Distribuição"):

- **Remover** o parágrafo de instrução (`"Próximos OIPs e Autoridades já pré-distribuídos..."`) — deixar só o título "Em Atendimento" + relógio.
- **Remover** os rótulos repetidos `OIP:` / `Autoridade:` em cada linha.
- **Remover** os badges `Slot 2`, `Slot 3`, `Slot 4` e o texto `aguardando BU`.
- Reformular a seção como uma **tabela única** (cabeçalho fixo: `BU` · `Hora` · `OIP` · `Autoridade` · `Ações`):
  - **Linhas 1..N**: ocorrências reais já em atendimento (com selects inline editáveis para OIP/Autoridade, botão Continuar/Remover, igual ao atual mas em formato `<tr>`).
  - **Linha "Próximo"**: input de Nº BU + input de hora + OIP/Autoridade pré-preenchidos (como texto, sem rótulo) + botão Confirmar.
  - **Linhas seguintes (slots preview)**: apenas mostram OIP / Autoridade previstos como texto simples, sem badge "Slot N" e sem o texto "aguardando BU". Estilo `opacity-60` para distinguir.
- Resultado visual: parece uma planilha enxuta, com colunas alinhadas e sem repetição de rótulos linha a linha.

### 2. Editar horário de tramitação em ocorrências em atendimento

Hoje a hora aparece como texto somente leitura na linha em atendimento (`fmtTime(occ.tramitation_time)`). Vou trocar por um `<input type="time" step="1">` inline que, ao alterar (`onBlur` ou `onChange` debounced), chama `onUpdate(occ.id, { tramitation_time: ISO })`. O ISO é construído com `shift.shift_date` + horário escolhido. Mostrar "—" quando vazio e permitir limpar.

A mesma edição inline também valerá na aba "Já Atendidas" (coluna Horário), trocando o `<td>` estático por input de hora.

### 3. Remover preenchimento automático de `tramitation_time` ao enviar ao plantão

O usuário esclareceu que esse horário vem de outro sistema; o app não deve mais inserir um valor automático. Mudanças em `src/pages/Index.tsx`:

- Linha 82 (envio da triagem ao plantão, fluxo principal): remover `tramitation_time: new Date().toISOString()` do payload — deixar o campo `null`.
- Linha 194 (segundo fluxo análogo de envio ao plantão): mesma remoção.
- Os blocos que removem `tramitation_time` no merge (linhas 122 e 201) continuam corretos e ficam.

Em `src/components/shift/OccurrencesTab.tsx`:

- Linha 228 (cadastro manual concluído via modal): remover o fallback `|| new Date().toISOString()`, enviando apenas `form.tramitation_time` (pode ser `null/undefined`).
- A entrada via slot "Próximo" (linha 148–156) **mantém** o uso de `newTime || agora`, pois ali o usuário está digitando manualmente o horário no momento da entrada à fila — é o caso legítimo de input direto. Mas como o usuário quer poder editar depois (item 2), isso já fica resolvido.

### 4. Arquivos alterados

```text
src/components/shift/OccurrencesTab.tsx   — refatorar "Em Atendimento" para tabela; input de hora editável; remover fallback de tramitation_time no save
src/pages/Index.tsx                       — não setar tramitation_time automaticamente ao enviar ao plantão (2 ocorrências)
```

Sem mudanças em DB, edge functions, tipos ou hooks.
