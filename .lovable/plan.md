## Problemas e plano

### 1. Bug: distribuição repete servidor que já está em atendimento

**Causa**: em `src/pages/Index.tsx` a função `pickNextAssignees` (linha 56) calcula a fila usando apenas `occurrences.filter(o => o.status !== "em_atendimento")` — ou seja, ignora a carga das ocorrências em andamento. Se o OIP X já tem 1 BU em atendimento, ele aparece com carga 0 e é escolhido de novo no próximo BU.

A `OccurrencesTab` (que mostra a tabela em distribuição) usa `occurrences` inteiro, por isso a previsão lá está correta. Daí a divergência: a tabela mostra um nome, mas ao enviar pela triagem é gravado outro (ou o mesmo de novo).

**Correção**: passar `shift.occurrences` (todas) para `predictSubteamQueue` / `predictQueue` em `pickNextAssignees`, exatamente como `OccurrencesTab.tsx` faz. Remover o `.filter(o => o.status !== "em_atendimento")`.

```ts
// src/pages/Index.tsx — pickNextAssignees
const all = shift.occurrences;          // antes: completed = filter !== em_atendimento
const invSub  = predictSubteamQueue(active.oip_subteams || [], all, [], "investigator", 1, now);
const authSub = predictSubteamQueue(active.delegado_subteams || [], all, [], "authority", 1, now);
```

### 2. Nova aba "Sem Oitiva" (procedimentos sem ordem rígida)

**Modelo de dados**

Adicionar um novo valor ao status da ocorrência: `sem_oitiva`. É um plantão paralelo ao "em atendimento", com sua própria fila independente, mas usando os mesmos OIPs/Autoridades do plantão (a flexibilidade fica por conta do usuário, que pode editar OIP/Autoridade inline).

Migração SQL (Cloud):
- Não há CHECK constraint em `shift_occurrences.status` hoje — basta ampliar o tipo TS. Adicionar `sem_oitiva` ao enum TS `OccurrenceStatus` em `src/types/shift.ts`.
- RLS já cobre (por `created_by`). Sem alteração.

**UI — `src/components/shift/OccurrencesTab.tsx`**

Renomear/reordenar as abas:

```text
[ Em Distribuição (N) ]  [ Sem Oitiva (M) ]  [ Já Atendidas (K) ]
```

A aba "Sem Oitiva" replica visualmente o card "Em Atendimento" (mesma tabela: BU · Hora · OIP · Autoridade · Ações), com:

- Lista das ocorrências `status === "sem_oitiva"` (editáveis inline igual à aba em distribuição: hora, OIP, autoridade via Select, skip, Continuar, Remover).
- Linha de entrada (input BU + hora + OIP/Autoridade pré-preenchidos pela fila preditiva) para registrar uma ocorrência diretamente como `sem_oitiva`.
- A fila preditiva é calculada **considerando apenas as ocorrências `sem_oitiva`** (ordem independente da aba "em distribuição"), usando os mesmos `oip_subteams` / `delegado_subteams`.

```ts
const inAttendance  = occurrences.filter(o => o.status === "em_atendimento");
const semOitiva     = occurrences.filter(o => o.status === "sem_oitiva");
const completed     = occurrences.filter(o => o.status === "atendida");

// Fila preditiva independente para Sem Oitiva
const predictedInvSO  = predictSubteamQueue(oipSubteams, semOitiva, [], "investigator", 5, now);
const predictedAuthSO = predictSubteamQueue(delSubteams, semOitiva, [], "authority", 5, now);
```

**Continuar atendimento (botão "Continuar")**: ao salvar com finalize, status passa para `atendida` (move para "Já Atendidas"), igual à aba em distribuição. Também permitir "mover para em distribuição" via select de status (caso o usuário decida que o procedimento precisa de oitiva).

**Triagem → Sem Oitiva (opcional, fora deste loop)**: por enquanto a triagem continua mandando para `em_atendimento`. O usuário pode mover manualmente. Se quiser detecção automática (ex.: TC/BOC entram direto em sem_oitiva), fica para iteração futura.

**Resumo / Estatísticas**: rapidamente verificar `ResumoTab.tsx` e `StatisticsTab.tsx` — onde houver distinção `em_atendimento` vs `atendida`, tratar `sem_oitiva` como "ainda não finalizada" (mesmo bucket de em atendimento, ou contador próprio se útil). Sem mudança comportamental significativa esperada.

### Arquivos alterados

```text
src/pages/Index.tsx                        — corrigir pickNextAssignees (usar todas as occurrences)
src/types/shift.ts                         — adicionar "sem_oitiva" ao OccurrenceStatus
src/components/shift/OccurrencesTab.tsx    — nova aba + fila preditiva independente
src/components/shift/ResumoTab.tsx         — incluir sem_oitiva como pendente (revisar)
src/components/shift/StatisticsTab.tsx     — idem (revisar)
```

Sem migração de banco, sem edge functions, sem mudanças em hooks.
