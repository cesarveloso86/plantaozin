# Corrigir data do plantão no Meu Histórico (off-by-one)

## Causa raiz

Em `src/pages/MeuHistorico.tsx` (linha 331), a data do plantão é renderizada com `fmtDateTime(g.shift_date)`. O valor de `shift_date` vem da coluna `shifts.shift_date` do Postgres (tipo `date`, formato `YYYY-MM-DD`, sem fuso).

`fmtDateTime` (em `src/lib/utils.ts`) faz `new Date(iso).toLocaleString("pt-BR", ...)`. Quando `iso` é `"2026-05-01"`, o JS interpreta como **UTC meia-noite** e, ao formatar em pt-BR (BRT = UTC-3), exibe **30/04/2026** — um dia antes. É exatamente o comportamento que o usuário descreveu.

O projeto já tem o helper correto para esse caso: `formatLocalDateBR` (mesmo arquivo `utils.ts`), que faz parse manual de `YYYY-MM-DD` em data local. Ele é usado em `Plantao.tsx` e `ShiftSelector.tsx` justamente para evitar esse off-by-one.

## Mudança

**Arquivo:** `src/pages/MeuHistorico.tsx`

1. Adicionar `formatLocalDateBR` ao import de `@/lib/utils`.
2. Trocar `fmtDateTime(g.shift_date)` por `formatLocalDateBR(g.shift_date)` na linha 331.

`fmtDateTime` continua sendo usado para timestamps reais (`tramitation_time`, `created_at`) — esses são `timestamptz` e estão corretos. A troca é apenas para o campo `shift_date` (tipo `date`).

## Diff conceitual

```ts
// import
- import { fmtDateTime } from "@/lib/utils";
+ import { fmtDateTime, formatLocalDateBR } from "@/lib/utils";

// render
- <span>Plantão {g.shift_date ? fmtDateTime(g.shift_date) : "—"}</span>
+ <span>Plantão {g.shift_date ? formatLocalDateBR(g.shift_date) : "—"}</span>
```

## Arquivos a editar

- `src/pages/MeuHistorico.tsx`
