## Correções no fluxo de plantão e Meu Histórico

### 1. Botão "Continuar" duplicado em "Em Atendimento"
**Arquivo:** `src/components/shift/OccurrencesTab.tsx` (linhas 467–472)

Hoje há dois botões idênticos `<Edit/> Continuar` lado a lado. Manter apenas um.

### 2. Diálogo "Continuar Atendimento": permitir salvar parcialmente
**Arquivo:** `src/components/shift/OccurrencesTab.tsx` (linhas 699–705 + `handleSave`)

Atualmente, quando o usuário está editando uma ocorrência `em_atendimento`, o único botão é "Concluir Atendimento" que força `status: "atendida"`. Vamos:

- Adicionar um segundo parâmetro a `handleSave(finalize: boolean)`.
- Quando `isInAttendance && !finalize`, persistir os campos sem alterar o `status` (continua `em_atendimento`).
- No rodapé do `Dialog`, quando `isInAttendance`, mostrar dois botões lado a lado:
  - **"Salvar"** (variant outline) → `handleSave(false)` → mantém em atendimento.
  - **"Concluir Atendimento"** (default) → `handleSave(true)` → marca como atendida.
- Para os demais casos (nova ocorrência ou edição de já atendida), manter apenas o botão atual.

### 3. Skip (pular a vez) deve seguir 1→2→3, não alternar 1→2→1→2
**Arquivos:** `src/components/shift/OccurrencesTab.tsx`, `src/lib/availability.ts`

Causa raiz: `nextSkipping(members, current, when, skipped)` apenas devolve o primeiro `available` que não está no `skipSet`. Não considera carga acumulada, então sempre volta para o "primeiro depois do current", produzindo 1↔2 quando há acumulação de pulos parciais. Mudanças:

- **Em `OccurrencesTab.tsx`**, refatorar `handleSkipInv`, `handleSkipAuth`, `skipPendingInv`, `skipPendingAuth` para usar `predictSubteamQueue`/`predictQueue` passando `skipped = [...history, current]`. Pegar `result[0]` como próximo nome. Isso usa a fila preditiva real (carga + ordem das subequipes), garantindo a sequência 1→2→3→…
- Para "Em Atendimento" (ocorrência já criada), persistir um histórico de pulos **na sessão** (`Record<occId, string[]>`) análogo ao já existente para a fila pendente, para que cliques sucessivos avancem corretamente.
- `nextSkipping` continua existindo como fallback para listas planas sem subequipes; mas o caminho principal usará a fila preditiva.

### 4. Distribuição → rotacionar fila preditiva imediatamente
**Arquivo:** `src/components/shift/OccurrencesTab.tsx`

Hoje `completed = occurrences.filter(o => o.status !== "em_atendimento")`. Como ocorrências enviadas via "Enviar ao Plantão" entram com status `em_atendimento`, elas **não contam** para a carga em `predictSubteamQueue`/`predictQueue`. Resultado: a fila preditiva mostra sempre o mesmo nome no topo até a ocorrência ser concluída.

- Passar para `predictSubteamQueue`/`predictQueue` a lista cheia (`occurrences`), não só `completed`. A função já soma o campo `investigator`/`authority` independente do status, então basta trocar o argumento.
- Manter `completed` apenas para a aba "Já Atendidas" e contadores.
- Resultado: ao distribuir uma ocorrência (manual ou via triagem) que já vincula um OIP/Autoridade, a próxima sugestão na "Fila Preditiva" rotaciona automaticamente.

### 5. Remover botão "Gerar depoimentos agora" da tela de triagem
**Arquivo:** `src/pages/Index.tsx` (componente `TriageQuickCard`, linhas 271–276)

- Remover o botão `<Sparkles/> Gerar depoimentos agora`, sua prop `onGenerateFull` e a função `handleGenerateFullNow` em `Index`.
- A geração passa a ocorrer **somente** em "Meu Histórico", após distribuição ao plantão (regra única de acesso, alinhada à retenção de 24h).

### 6. Meu Histórico: excluir individual + limpar histórico + verificação do PDF
**Arquivo:** `src/pages/MeuHistorico.tsx`

**a) Excluir individual:** ao lado dos botões "Ver/Gerar", incluir um `<Trash2/>` com `AlertDialog` confirmando. Ação chama `supabase.from("shift_occurrences").delete().eq("id", row.id)` e remove a linha do estado.

**b) Limpar histórico:** botão no cabeçalho ("Limpar histórico") com `AlertDialog`. Apaga todas as ocorrências atualmente filtradas em que o usuário aparece como `investigator` ou `authority`:
```
.delete().or(`investigator.eq.${myName},authority.eq.${myName}`)
```
Para admin com filtro ativo, usa o nome filtrado.

> Observação importante: a exclusão remove o vínculo do plantão. Os PDFs (já em `bo-pdfs/`) são gerenciados separadamente pelo cron de retenção de 24h.

**c) Verificação da função "Gerar depoimentos":**
- **Origem do PDF:** `useAnalysis.persistTriageForShift` faz upload do PDF em `bo-pdfs/{user_id}/{analysis_id}.pdf` e grava `pdf_storage_path` em `analyses`. Em "Meu Histórico", `handleGenerate` chama `generateFullFromAnalysis(analysis_id)`, que:
  1. Lê `pdf_storage_path` da tabela `analyses`.
  2. Invoca a edge function `analyze-bo` em modo `full` passando o caminho.
  3. Salva `result` completo em `analyses`.
  4. **Apaga** o PDF do storage e zera `pdf_storage_path` (LGPD).
- **Por que aparece "PDF expirado":** ocorre em duas situações legítimas:
  1. Já foi gerado depoimento alguma vez (PDF descartado intencionalmente após geração).
  2. Cron `cleanup-expired-pdfs` (24h) rodou.
- **Funcionamento atual:** a lógica está correta. O que faremos:
  - Ajustar a UI para deixar **claro** quando o PDF foi descartado por geração ("Depoimentos já gerados — PDF descartado") versus expiração de 24h (comparando `created_at` com `Date.now() - 24h`).
  - Recarregar a linha após gerar (já é feito): `pdf_storage_path: null, has_full_result: true`.
  - Confirmar que o RLS permite ao OIP/Autoridade ler `analyses` mesmo não sendo o `user_id` que fez o upload. **Isto é um problema:** RLS atual de `analyses` exige `auth.uid() = user_id` (ou admin). Se o OIP que vai gerar não foi quem fez upload, o `select` retornará vazio e o botão nunca aparecerá.

  **Correção:** adicionar política RLS de leitura em `analyses` para usuários cujo nome aparece como `investigator` ou `authority` em `shift_occurrences` vinculadas a esta análise:
  ```sql
  create policy "OIP/Autoridade can read linked analyses"
  on public.analyses for select to authenticated
  using (
    exists (
      select 1 from public.shift_occurrences so
      join public.profiles p on p.id = auth.uid()
      where so.analysis_id = analyses.id
        and (so.investigator = p.full_name or so.authority = p.full_name)
    )
  );
  ```
  E uma política equivalente para `update` (necessária para `generateFullFromAnalysis` salvar o `result` e zerar `pdf_storage_path`):
  ```sql
  create policy "OIP/Autoridade can update linked analyses"
  on public.analyses for update to authenticated
  using ( ...mesma condição... )
  with check ( ...mesma condição... );
  ```

### Detalhes técnicos

```text
Skip flow (corrigido)
┌─ skipPendingInv(idx) ──────────────────────────────┐
│ skipped ← skippedInvByIdx[idx] ∪ {currentInv}      │
│ next ← predictSubteamQueue(...,                    │
│        skippedSubteams: subteamsOf(skipped))[0]    │
│        ?? predictQueue(...members, skipped)[0]     │
│        ?? nextSkipping(...) // fallback            │
│ pendingQueue[idx].investigator ← next              │
└────────────────────────────────────────────────────┘
```

### Arquivos editados
- `src/components/shift/OccurrencesTab.tsx` — remover botão duplicado, adicionar Salvar/Concluir, refatorar skips, contar `inAttendance` na carga.
- `src/pages/Index.tsx` — remover "Gerar depoimentos agora" da TriageQuickCard.
- `src/pages/MeuHistorico.tsx` — adicionar excluir individual, limpar histórico, mensagem refinada de PDF descartado vs expirado.
- `supabase/migrations/<novo>.sql` — políticas RLS em `analyses` para OIP/Autoridade vinculados via `shift_occurrences`.

### Fora do escopo
- Não alteramos retenção de 24h nem a edge function `analyze-bo`.
- Não mexemos em `useAnalysis.ts` (fluxo correto).
