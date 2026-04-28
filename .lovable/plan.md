

# Wizard de criação com regras de rotação por equipe

## O que muda em relação ao plano anterior

Removo o "Repetir última escala" (incompatível com rotação) e substituo por **rotação automática**: o sistema lê o último plantão da equipe e aplica as regras de deslocamento de turno e rotação interna automaticamente. O usuário só confirma.

## Fluxo novo (3 passos, mobile-first)

```text
Passo 1 — Identificação                Passo 2 — Composição           Passo 3 — Revisão
┌──────────────────────┐              ┌──────────────────────┐       ┌──────────────────────┐
│ Equipe  [ A ▾ ]      │              │ [Deleg(2)][OIP(3)][I]│       │ Equipe A · 22/04 10h │
│ Data    [Hoje][Aman.]│      →       │                      │  →    │ Delegados: ...       │
│ Início  [10:00]      │              │ ⚡ Rotação aplicada  │       │ OIPs: ...            │
│                      │              │   (1 toque p/ desfa.)│       │ ISEO: ...            │
│ ⚡ Aplicar rotação?  │              │                      │       │ + Ausências (opc.)   │
│   [Sim] [Montar nova]│              │ [+ membro] [Editar]  │       │ [Criar Plantão]      │
└──────────────────────┘              └──────────────────────┘       └──────────────────────┘
```

**Caminho mais curto (rotação ok):** equipe → "Sim, aplicar rotação" → revisar → criar = **4 cliques**.

## Regras de rotação (por equipe)

Cada equipe tem um arquivo de regras em `src/components/shift/teamRules.ts` (novo), declarativo:

```ts
export const TEAM_RULES: Record<string, TeamRule> = {
  "Equipe A": {
    delegado: { strategy: "shift", presets: ["Diurno", "Noturno"] },
    oip:      { strategy: "shift", presets: ["A", "B", "C"] },
    iseo:     { strategy: "rotateInternal" },
  },
  "Equipe B": { ... },
  // etc.
};
```

Estratégias suportadas:
- **`shift`**: subequipe que era preset[0] passa a preset[1], preset[1] → preset[2], último → preset[0] (carrossel de turnos).
- **`rotateInternal`**: dentro da subequipe, primeiro membro vira último (deslocamento posicional).
- **`shift+rotateInternal`**: aplica os dois.
- **`none`**: subequipe fixa (ex: Delegado de plantão único).

A função `applyRotation(lastShift, rules)` em `useShift.ts` recebe o último plantão da equipe e devolve o payload já rotacionado pronto pra criar.

**Exemplo concreto** (Equipe A no plantão N):
- Sub OIP que estava no preset A → vira B
- Membro que era 1º na sub A → vira último na sub B
- Delegado Diurno → vira Noturno

No passo 2 o usuário vê o resultado da rotação com badges "🔄 Rotacionado" e pode editar manualmente qualquer subequipe (override). Botão "Desfazer rotação" volta pra escala anterior.

## Como cadastrar as regras (sem código pra você)

Como as regras variam por equipe e você está no celular, proponho **2 opções de cadastro**:

1. **Arquivo declarativo** (recomendado pra MVP): eu monto o `teamRules.ts` com as 5 equipes (A-E) usando os presets atuais (`A`, `B`, `C` pra OIP; `Diurno`, `Noturno`, `24h` pra Delegado). Você me confirma a ordem da rotação por equipe em texto livre ("Equipe A: OIP gira A→B→C, Delegado gira Diurno→Noturno") e eu codifico.
2. **UI de admin** (futuro): tela em `/admin/equipes` pra editar regras visualmente. Fica pra v2 — agora prioriza ganho de UX.

## Componentes / arquivos

| Arquivo | Mudança |
|---|---|
| `src/components/shift/teamRules.ts` (novo) | Regras declarativas por equipe |
| `src/components/shift/rotation.ts` (novo) | Funções puras: `applyRotation`, `shiftPresets`, `rotateMembers` (+ testes unitários simples) |
| `src/components/shift/CreateShiftDialog.tsx` | Reescrito como wizard 3 passos |
| `src/components/shift/ShiftWizardSteps.tsx` (novo) | Indicador de progresso |
| `src/components/shift/SubteamComposer.tsx` | Modo `compact` p/ caber em tabs; badge "Rotacionado"; botão "Adicionar todos da equipe X" |
| `src/hooks/useShift.ts` | `getLastShiftForTeam(teamName)` (lê 1 row do Supabase, ordenado por `created_at desc`) |
| `src/components/shift/scheduleConstants.ts` | Adicionar presets `Diurno`/`Noturno`/`24h` em `DELEGADO_PRESETS` |

## Detalhes técnicos

- Wizard: `useState<1|2|3>`, sem libs.
- `applyRotation` é função pura (fácil de testar/auditar) — recebe `Shift`, devolve payload do `onCreate`.
- IDs de subequipe e membros são regenerados com `crypto.randomUUID()` na rotação pra não colidir com o plantão anterior.
- Se não houver plantão anterior pra equipe, o passo 1 oferece só "Montar nova" (sem opção de rotação).
- Mantém retrocompatibilidade total com `onCreate` — payload final idêntico.
- Mobile 375px: cada passo cabe em ~1 viewport. Tabs no passo 2 evitam scroll vertical infinito.
- `AbsenceSelector` movido pro passo 3 (raramente usado).
- Validação por passo bloqueia "Próximo" se faltar dado essencial.

## O que preciso de você (texto, sem código)

Pra eu codar as regras certas, me passa por equipe (A, B, C, D, E) algo assim:

> "Equipe A — OIP: gira A→B→C→A; rotação interna sim. Delegado: gira Diurno→Noturno→Diurno; sem rotação interna. ISEO: fixo."

Se preferir, posso começar com uma **regra genérica padrão** (todas as equipes giram presets em ordem alfabética + rotação interna) e você ajusta depois pelo computador.

## O que NÃO muda

- Schema do banco, RLS, hooks de ocorrências, round-robin de atendimento.
- `EditShiftDialog` (foco é criação).
- Lógica de exports/análise.

