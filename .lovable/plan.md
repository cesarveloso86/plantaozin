## Problema

Hoje `predictSubteamQueue` (em `src/lib/availability.ts`) trata toda subequipe ativa como peso igual no round-robin. Resultado: quando A + C estão ativas, a fila alterna A–C–A–C, e o coringa (Geneses) reaparece logo na próxima vaga. Comportamento esperado:

- **1 subequipe não-coringa ativa + coringa** → coringa entra **por último**, 1 vaga por ciclo dos membros da outra subequipe.
- **2+ subequipes não-coringa ativas + coringa** → coringa entra na **rotação normal**, como uma subequipe qualquer.
- **Só coringa ativo** → coringa rotaciona normalmente entre seus membros.
- **Nenhum coringa ativo** → nada muda.

O coringa é identificado por `preset === "C"` (somente OIP).

## O que muda

### 1. `src/lib/availability.ts` — `predictSubteamQueue`

Trecho principal a reescrever no laço de escolha de subequipe:

```text
active = subteams ativas no horário
nonCoringa = active.filter(s => s.preset !== "C")
coringa    = active.filter(s => s.preset === "C")

if coringa.length === 0 OR nonCoringa.length === 0 OR nonCoringa.length >= 2:
    // comportamento atual (round-robin equilibrado entre todas as ativas)
else:
    // exatamente 1 não-coringa + 1+ coringa
    // dentro do laço de picks:
    //   - calcula "ciclo" da subequipe não-coringa: posição = carga atual % membros_disponíveis
    //   - se posição === 0 E já passou pelo menos 1 vez E há slot livre para coringa neste ciclo
    //     → escolhe coringa (subequipe coringa de menor carga)
    //   - senão → escolhe não-coringa
```

Implementação concreta: contador `nonCoringaPicksSinceLastCoringa`. Após cada `count` de membros da não-coringa, intercala 1 pick de coringa. Como cada subequipe coringa pode ter >1 membro, alterna entre coringas pelo mesmo critério de menor carga.

Pseudocódigo do laço:

```text
N = total de membros disponíveis na única subequipe não-coringa
contador = (carga inicial da não-coringa) % N
para cada pick i em 0..count-1:
    se há coringa ativo E contador > 0 E contador % N === 0:
        escolhe coringa de menor carga
        // não incrementa contador
    senão:
        escolhe não-coringa, atualiza loads
        contador += 1
```

Isso garante: depois de cada "volta completa" pelos membros da subequipe não-coringa, entra 1 coringa. Empate de carga inicial usa índice de cadastro (já existe).

### 2. `pickNextAssignees` em `src/pages/Index.tsx`

Continua chamando `predictSubteamQueue(..., 1, ...)`. Como o algoritmo está dentro da função, a sugestão automática passa a respeitar a regra sem mudança no chamador.

### 3. `OccurrencesTab.tsx`

A fila preditiva exibida (próximos 10) também passa a respeitar a regra automaticamente — nada a alterar no componente.

### 4. Validação manual após implementar

Cenário 1 (16:00–21:00, B + C ativos, B com 3 membros):
- Sequência esperada: B1, B2, B3, C, B1, B2, B3, C…

Cenário 2 (21:00–04:00, A + B + C ativos — só se houver overlap):
- Sequência esperada: rotação normal A–B–C–A–B–C (coringa entra no meio).

Cenário 3 (10:00–16:00, só A):
- Sem coringa, comportamento atual.

## Fora do escopo

- Nenhuma mudança de schema, banco ou UI de configuração.
- Sem alteração na fila "Sem Oitiva" — usa a mesma função e herda o comportamento corrigido.
- Sem marcador explícito de coringa por enquanto (segue preso ao preset C).