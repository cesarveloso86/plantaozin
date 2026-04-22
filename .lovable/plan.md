

# Análise em duas fases: triagem rápida + geração sob demanda

## Objetivo

Hoje o `analyze-bo` faz **tudo de uma vez** (triagem + depoimentos + despacho), levando ~30-60s antes da ocorrência poder ser distribuída. Vamos separar em **2 etapas independentes**:

1. **Triagem rápida** (~5-10s): só extrai dados para distribuição (BU, natureza, regional, nomes, tipificação).
2. **Geração completa** (sob demanda): depoimentos + despacho, disparada pelo OIP responsável depois de receber a ocorrência.

**Não precisa refatorar tudo** — é uma extensão incremental. O fluxo atual continua funcionando como fallback/modo manual.

## Fluxo novo

```text
[Upload PDF]
     ↓
[Triagem rápida]  ← 5-10s, só dados estruturados
     ↓
[Enviar ao Plantão]  ← imediato, sem esperar depoimentos
     ↓
[OIP recebe na fila "Em Distribuição"]
     ↓
[OIP clica "Gerar depoimentos"]  ← só agora roda IA pesada
     ↓
[Depoimentos + despacho prontos no card da ocorrência]
```

## Mudanças

### 1. Edge function `analyze-bo` — adicionar modo `triage_only`

Aceitar novo parâmetro `mode: "triage" | "full"` (default `"full"` p/ retrocompatibilidade):
- `"triage"`: prompt enxuto, retorna só `triagem` (numero_bo, natureza, delegacia, data_fato, local_fato, regional_codigo, unidade_registro, resumo curto, alertas, tipificações sugeridas, nomes de condutor/vítima/interrogado).
- `"full"`: comportamento atual (triagem + depoimentos + despacho).

Prompt de triagem usa modelo mais rápido (`google/gemini-2.5-flash-lite` ou `flash`) e pede JSON menor → resposta em segundos.

### 2. Hook `useAnalysis` — expor `analyzeTriage` e `generateFull`

```ts
const { 
  status, result, triageResult, 
  analyzeTriage,   // novo: roda só triagem
  generateFull,    // novo: roda depoimentos+despacho a partir do PDF salvo
  analyze,         // mantido: fluxo completo legado
  reanalyze, reset
} = useAnalysis();
```

- `analyzeTriage(file)`: salva base64 em ref, chama edge function com `mode:"triage"`, retorna rápido.
- `generateFull(occurrenceId)`: pega base64 + triagem do banco, chama com `mode:"full"`, atualiza `analyses` e a ocorrência vinculada.

### 3. Banco — vincular ocorrência → análise

A coluna `shift_occurrences.analysis_id` **já existe**. Vamos usar:
- Ao enviar triagem ao plantão: cria registro em `analyses` (com `result` parcial só de triagem) e grava `analysis_id` na ocorrência.
- Adicionar coluna `analyses.pdf_base64 text` (nullable) p/ guardar o PDF temporariamente até a geração completa, OU re-uploadar se necessário. **Alternativa mais limpa:** criar bucket `bo-pdfs` (privado, RLS por user_id) e guardar o PDF — descartado após geração completa.

**Recomendação:** bucket privado com auto-delete após `full` rodar, mantém princípio LGPD (PDF efêmero).

### 4. UI — `Index.tsx` (upload)

Após triagem concluir, mostrar **card resumido** (não o `AnalysisResultView` completo) com:
- BU, natureza, regional, nomes
- Botão primário: **"Enviar ao Plantão"** (rápido)
- Botão secundário: **"Gerar depoimentos agora"** (fluxo antigo, opcional)

### 5. UI — `OccurrencesTab.tsx` (plantão)

Em cada ocorrência da lista "Em Atendimento" que tenha `analysis_id` mas só com triagem:
- Botão **"Gerar depoimentos"** com loader inline.
- Quando pronto, abre `AnalysisResultView` completo no mesmo card (modal ou expand).

### 6. Constante de modelo

Adicionar em `analyze-bo/index.ts`:
```ts
const TRIAGE_MODEL = "google/gemini-2.5-flash-lite";
const FULL_MODEL = "google/gemini-2.5-flash"; // atual
```

## Detalhes técnicos

**Tipos novos** em `src/types/analysis.ts`:
```ts
export interface TriageResult {
  triagem: RelatorioTriagem;
  // depoimentos/despacho ausentes
}
export type AnalysisMode = "triage" | "full";
```

`AnalysisResult` permanece como está (full). `TriageResult` é subset.

**Migração SQL** (se optarmos por bucket): criar bucket `bo-pdfs` privado + policies RLS (user lê/escreve só os próprios) + edge function deleta blob ao final do `mode:"full"`.

**Retrocompatibilidade**: `analyze` atual continua funcionando — é só um wrapper de `analyzeTriage` + `generateFull` sequencial. Histórico antigo segue exibindo normalmente.

## O que NÃO muda

- Estrutura de `analyses` (só ganha 1 coluna ou bucket auxiliar).
- `AnalysisResultView` — segue renderizando full result.
- `useShift`, `OccurrencesTab` lógica de fila, round-robin, exports.
- RLS, auth, roles.

## Escopo

**Não é refatoração total.** São ~6 arquivos tocados:
- `supabase/functions/analyze-bo/index.ts` (adicionar branch `mode`)
- `src/hooks/useAnalysis.ts` (2 funções novas)
- `src/types/analysis.ts` (tipo novo)
- `src/pages/Index.tsx` (card resumido + 2 botões)
- `src/components/shift/OccurrencesTab.tsx` (botão "Gerar depoimentos")
- 1 migração (bucket OU coluna `pdf_base64`)

