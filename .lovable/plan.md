
# Plano revisado — Plantão UX (v2)

## 1. Filtro estrito por cargo
`MemberSelector`: quando `filterFuncao` setado, esconder seção "Outros". Mostrar "Nenhum membro com cargo X" se vazio.

## 2. Fluxo "Em Distribuição" → "Já Atendidas" (staging)
- Migration: `ALTER TABLE shift_occurrences ADD COLUMN status text NOT NULL DEFAULT 'em_atendimento'` + backfill existentes para `'atendida'`.
- `ShiftOccurrence.status: 'em_atendimento' | 'atendida'`.
- `Index.tsx > handleSendToShift` → cria com `status='em_atendimento'`.
- `OccurrencesTab`:
  - **Em Distribuição** = pendentes + ocorrências `em_atendimento`.
  - **Já Atendidas** = `atendida`.
- Salvar em dialog de edição → vira `atendida` (botão "Concluir atendimento").

## 3. UX de edição em atendimento
- Badge: `Em atendimento` (amber) vs `Atendida` (green).
- Botão muda label conforme status: "Continuar atendimento" / "Editar".
- Contador `num_hearings` com `+`/`-` inline na tabela.

## 4. Lógica da fila — explicação + nova abordagem por equipes

**Hoje**: round-robin ponderado por menor carga entre disponíveis no horário (empate = ordem de cadastro).

**Mudança solicitada — escalas independentes + equipes pré-montadas**:

### 4a. Schedules independentes para Delegados e OIPs
- Hoje OIPs e Delegados compartilham os mesmos presets T1/T2. Não reflete a realidade.
- Reformular `scheduleConstants.ts` com **presets separados** baseados na escala real:
  - **Equipe A** (ex: Aldari + Victor): `10:00–16:00` + `21:00–01:00`
  - **Equipe B** (ex: Guilherme + Elismar): `16:00–21:00` + `04:00–10:00`
  - **Equipe C** (ex: Cleriston + Davi): `20:00–04:00` (janela única)
- Cada equipe pode misturar Delegado + OIP — eles compartilham a janela da equipe, não do cargo.

### 4b. Cadastro por equipe (não individual)
- Em `CreateShiftDialog`: substituir os 3 `MemberSelector` independentes por um **"Compositor de Equipes"**:
  - Botão "Adicionar Equipe" → escolhe preset (A/B/C/Custom) → adiciona Delegado(s) + OIP(s) à equipe.
  - Equipes ficam listadas em ordem (1ª, 2ª, 3ª) — essa ordem **define a ordem inicial da fila preditiva**.
  - ISEO continua selecionado à parte (sempre 24h).
- Modelo:
  ```ts
  interface ShiftTeam {
    id: string;
    label: string;          // "1ª Equipe"
    preset: 'A'|'B'|'C'|'CUSTOM';
    windows: ScheduleWindow[];
    authorities: ShiftMember[];
    investigators: ShiftMember[];
  }
  ```
- `Shift` ganha `teams: ShiftTeam[]` (mantém `authorities/investigators/iseo` derivados para compat).

### 4c. Fila preditiva por equipe
- `predictQueue` reformulada:
  1. Filtra equipes disponíveis no horário atual (alguma janela ativa).
  2. Round-robin **entre equipes** (não entre indivíduos), respeitando a ordem 1ª→2ª→3ª.
  3. Dentro da equipe escolhida, distribui o atendimento ao Delegado + OIP daquela equipe (par fixo).
  4. Ponderação por menor carga acumulada entre equipes disponíveis para desempate.
- Resultado: fila mostra "Próximo: 1ª Equipe (Aldari + Victor)" — par já formado, sem escolha individual.

## 5. Migration de dados
- Atualizar 20 membros de teste: manter `cargo='OIP'` para 14 e setar `cargo='Delegado'` para 6 (para testar filtro estrito).

## Arquivos
**Migration**: `shift_occurrences.status`
**Types**: `shift.ts` (+ `ShiftTeam`, `ShiftOccurrence.status`)
**Criar**: `src/components/shift/TeamComposer.tsx`
**Editar**: `scheduleConstants.ts` (presets A/B/C), `availability.ts` (queue por equipe), `MemberSelector.tsx` (filtro estrito), `CreateShiftDialog.tsx` + `EditShiftDialog.tsx` (TeamComposer), `OccurrencesTab.tsx` (badges, contador inline, status), `Index.tsx` (status inicial), `useShift.ts` (teams, concludeOccurrence), `exportXlsx.ts` (só `atendida`)

## Comando
Responda **"Aprovado, implementar"** para iniciar pela migration + types + TeamComposer.
