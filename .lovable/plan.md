
# Geração de depoimentos no histórico do OIP (janela 24h)

## Decisão LGPD aprovada

PDF do BU fica retido no bucket `bo-pdfs` por **no máximo 24h** após a triagem. Cron diário apaga objetos expirados e zera `pdf_storage_path` em `analyses`. Depois disso, só sobra o resultado processado em `analyses.result` (sem o PDF original).

A memória `mem://security/data-privacy` será atualizada para refletir essa nova regra ("PDFs retidos no máximo 24h, descartados via cron").

## O que muda na UX

### 1. Página "Meu Histórico" (rota nova `/meu-historico`)

Lista as ocorrências em que o usuário logado atuou como **OIP (investigator)** ou **Autoridade**, agrupadas por plantão e ordenadas por data (mais recente primeiro).

```text
┌────────────────────────────────────────────┐
│ Meu Histórico              [filtro: data ▾]│
├────────────────────────────────────────────┤
│ ▼ Plantão 22/04 — Equipe A                 │
│   BU 12345 · Furto · 14:32                 │
│      [👁 Ver triagem] [⚡ Gerar depoimentos]│
│   BU 12346 · Lesão · 16:10                 │
│      [👁 Ver triagem] · PDF expirado       │
│ ▼ Plantão 18/04 — Equipe A                 │
│   BU 12200 · Roubo                         │
│      [📄 Ver depoimentos gerados]           │
└────────────────────────────────────────────┘
```

Estados possíveis por linha:
- **PDF disponível + sem depoimentos**: botão `⚡ Gerar depoimentos`
- **Depoimentos já gerados**: botão `📄 Ver depoimentos gerados` (abre `AnalysisResultView`)
- **PDF expirado + sem depoimentos**: chip cinza "PDF expirado" com tooltip explicando LGPD

Admins veem um filtro extra "Ver de outro OIP" (select de membros).

### 2. Reforço na aba "Já Atendidas" (OccurrencesTab)

Adicionar o mesmo botão `⚡ Gerar depoimentos` nas linhas da aba "Já Atendidas", para o caso do OIP lembrar antes de sair do plantão. Reaproveita `handleGenerateDepoimentos` que já existe.

### 3. Item de menu novo na sidebar

"Meu Histórico" abaixo de "Plantão" (ou agrupado em uma seção "Pessoal" com "Perfil" + "Meu Histórico").

## Arquivos a tocar

| Arquivo | Mudança |
|---|---|
| `src/pages/MeuHistorico.tsx` (novo) | Lista filtrada de ocorrências do usuário com estados de PDF |
| `src/App.tsx` | Rota `/meu-historico` protegida |
| `src/components/AppSidebar.tsx` | Item "Meu Histórico" |
| `src/components/shift/OccurrencesTab.tsx` | Botão "Gerar" também na aba "Já Atendidas" (reuso do handler existente) |
| `src/hooks/useShift.ts` | Query: ocorrências por nome de OIP/autoridade + join com `analyses` para saber se PDF ainda existe |
| `supabase/functions/cleanup-expired-pdfs/index.ts` (novo) | Cron: apaga objetos do bucket >24h e zera `pdf_storage_path` |
| `supabase/config.toml` | `verify_jwt = false` para a função de cron |
| Cron via SQL (`pg_cron` + `pg_net`) | Schedule diário `0 3 * * *` (3h da manhã) |
| `mem://security/data-privacy` | Atualizar regra LGPD: 24h de retenção máxima |

## Detalhes técnicos

- **Reaproveitamento total do backend**: `analyze-bo` modo `full` + `useAnalysis.generateFullFromAnalysis(analysisId)` já fazem exatamente o trabalho. Zero mudança em edge functions de IA.
- **Filtro "minhas ocorrências"**: query em `shift_occurrences` filtrando `investigator = profile.full_name OR authority = profile.full_name`. RLS atual já permite leitura para autenticados.
- **Status do PDF**: join leve com `analyses` por `analysis_id` para ler `pdf_storage_path`. Se `null` → expirado. Se preenchido → disponível.
- **Cron de limpeza**: 
  - Edge function lista objetos do bucket `bo-pdfs` com `created_at < now() - interval '24h'`.
  - `storage.from("bo-pdfs").remove([paths])`.
  - `UPDATE analyses SET pdf_storage_path = NULL WHERE pdf_storage_path = ANY(...)`.
  - Agendamento com `pg_cron`: roda 1x por dia.
- **LGPD**: nada novo é exposto. O resultado processado (`analyses.result`) já é persistido hoje — o PDF é o único dado sensível, e ele continua tendo prazo de validade curto.

## O que NÃO muda

- Schema das tabelas (`analyses` e `shift_occurrences` já têm tudo).
- Edge function `analyze-bo`.
- RLS existente.
- Fluxo de upload/triagem/distribuição.
- `EditShiftDialog`, wizard de criação, exports.

## Próximos passos após aprovação

1. Criar página `MeuHistorico.tsx` + rota + item de menu.
2. Adicionar botão na aba "Já Atendidas".
3. Implementar edge function de cleanup + agendar cron.
4. Atualizar memória LGPD para refletir retenção de 24h.
