## Plano

### 1. `MeuHistorico.tsx` — card sem rolagem horizontal e regeneração individual

**Bug do scroll horizontal**: o `<DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">` não força wrap nos textos longos (despacho, depoimentos com palavras grandes). Vou:

- Adicionar `overflow-x-hidden` ao `DialogContent`.
- Em `AnalysisResult.tsx`, trocar `whitespace-pre-wrap` puro pelo combinado com `break-words` (ou `overflow-wrap: anywhere`) nos blocos de texto longo (despacho `<p>`, conteúdo do depoimento, alertas). Adicionar `min-w-0` nos pais dos textos para evitar que filhos com conteúdo longo expandam o flex/grid pai.
- Reduzir `max-w-5xl` para `max-w-4xl` no Dialog não é necessário; o problema é wrap.

**Regenerar individual por depoimento (a partir de Meu Histórico)**:

- Hoje, `AnalysisResult.tsx` já tem o botão "Corrigir" por depoimento (`FieldEditButton field="depoimento" index={i}`), mas não é exibido em `MeuHistorico` porque `onReanalyze` não é passado.
- Em `MeuHistorico.tsx`, passar `onReanalyze` ao `<AnalysisResultView>` que delega para uma nova função `useAnalysis.reanalyzeFromAnalysis(analysisId, instructions, field, depoimentoIndex)`.
- Em `useAnalysis.ts`, criar `reanalyzeFromAnalysis`:
  - Lê o `pdf_storage_path` e `result` da `analyses` row.
  - Busca `signature_style` do usuário logado (já existe `fetchSignatureStyle`).
  - Chama `analyze-bo` com `mode: "full"`, `pdf_storage_path`, `previous_result`, `instructions`, `field`, `depoimento_index`, `signature_style`.
  - Atualiza a row `analyses.result` com o novo resultado.
  - Atualiza `setResult` e retorna o resultado.
- `MeuHistorico` consome o `result`/`status` retornados, atualiza `resultData` e mostra spinner enquanto reanalyzing.

**Geração conforme perfil do usuário**: já funciona — `generateFullFromAnalysis` chama `fetchSignatureStyle(user.id)` do usuário logado (não do criador da análise). Sem mudança necessária. Vou apenas confirmar e remover comentário enganoso, se houver.

### 2. `OccurrencesTab.tsx` — fila preditiva pré-preenchida em "Em Atendimento"

**Comportamento novo**:

- Remover o card "Fila Preditiva — Disponíveis Agora" com badges dos próximos OIPs/Autoridades.
- Em vez disso, no card "Em Atendimento", **adicionar slots vazios pré-preenchidos** (placeholders virtuais) para os próximos N (=3 ou 5) atendimentos previstos:
  - Cada slot mostra: OIP sugerido + Autoridade sugerida + um campo de input para "Nº BU" e "Horário".
  - Ao preencher o BU e dar Enter (ou clicar "Confirmar"), chama `onAdd` com o BU e os OIP/Autoridade do slot, virando uma ocorrência real.
  - Os slots virtuais recalculam automaticamente conforme novas ocorrências entram.
- O botão único atual de "Inline add" (Nº BU / Horário / Adicionar à Em Atendimento) é substituído por essa lista de slots — o primeiro slot é equivalente ao add inline atual.
- Manter o cabeçalho do card com o relógio e a frase explicativa (compactada).

**Aumentar fonte dos nomes dos servidores**:

- Selects inline na seção "Em Atendimento" (linhas ~367-378): trocar `text-sm` por `text-base` no `SelectTrigger` e nos `SelectItem`. Aumentar largura de `w-[150px]` para `w-[180px]` para acomodar.
- Nos slots virtuais novos, mostrar nomes em `text-base font-medium` em vez de badges pequenas.

**Predição**:

- A função `predictSubteamQueue`/`predictQueue` recebe `count = N` e retorna a sequência. Cada slot virtual `i` consome `predictedInv[i]` e `predictedAuth[i]`.
- Ao confirmar um slot, a próxima ocorrência real entra no array `occurrences`, e os slots se reordenam naturalmente porque a predição já considera carga.

### 3. Arquivos alterados

```text
src/hooks/useAnalysis.ts                      — nova função reanalyzeFromAnalysis
src/pages/MeuHistorico.tsx                    — overflow-x-hidden no Dialog, passar onReanalyze
src/components/AnalysisResult.tsx             — break-words / min-w-0 nos blocos de texto
src/components/shift/OccurrencesTab.tsx       — remover card "Fila Preditiva"; slots virtuais em "Em Atendimento" com OIP/Autoridade pré-preenchidos; aumentar tamanho dos nomes
```

Sem mudanças em DB, edge functions ou tipos.