## Plano de correção

### 1. UI esmaecida de "gerando depoimentos" durante a análise prévia

**Causa**: `src/components/ProcessingStatus.tsx` lista 4 passos fixos: `reading`, `validating`, `analyzing`, `generating`. No fluxo de **triagem** (`analyzeTriage`), o status nunca passa por `validating` nem `generating` — vai de `reading` → `analyzing` → `triage_done`. O passo "Gerando minutas e despacho..." aparece sempre, esmaecido (`text-muted-foreground/50`), dando a impressão de que algo está sendo gerado.

**Correção**: tornar os passos exibidos dependentes do modo. Como a triagem é o fluxo padrão hoje, exibir apenas `reading` e `analyzing` enquanto `status` ∈ desses valores; remover `validating` e `generating` da lista quando estamos no fluxo de triagem. Como o fluxo "full" legado (`analyze()`) ainda existe em `useAnalysis.ts` mas não é mais chamado pela UI principal, simplificar `STEPS` para `["reading", "analyzing"]` e ajustar `STATUS_MESSAGES.analyzing` para "Analisando o BU..." (mais neutro, sem sugerir geração de depoimentos).

Arquivos: `src/components/ProcessingStatus.tsx`, `src/types/analysis.ts`.

### 2. PDF sumindo / "guardar PDF para geração de depoimentos não funciona"

**Diagnóstico**: o fluxo atual em `src/hooks/useAnalysis.ts` está correto em tese (`persistTriageForShift` faz upload no bucket `bo-pdfs` e grava `pdf_storage_path`), e o cleanup só apaga após 24h. Possíveis quebras reais que estão fazendo o PDF "não estar disponível":

  a. `persistTriageForShift` é chamado dentro de `handleSendTriageToShift` (`src/pages/Index.tsx`). Se o usuário clicar **"Enviar ao Plantão"**, o PDF é salvo. Mas se o registro for criado pelo fluxo de **inserção manual** (sem passar pela triagem da IA), nunca há `analysis_id` e portanto nunca há PDF — o histórico mostra "PDF expirado". Isso é esperado para inserção manual e não é bug.

  b. Há um caminho onde a ocorrência é criada em `Index.tsx` mesmo se o upload do storage falhar silenciosamente, porque `persistTriageForShift` retorna `null` em erro mas a UI mostra "Erro ao salvar triagem" — verificar se realmente está caindo aí.

  c. Após `generateFullFromAnalysis`, o código atual NÃO apaga o PDF (a remoção foi removida em iteração anterior). Bom — manteremos.

**Verificações/correções**:

- Adicionar logs em `persistTriageForShift` para distinguir falha de insert vs upload vs update.
- Em `Index.tsx`, tratar caso o upload falhe e a row `analyses` já tenha sido criada: nesse caso, fazer rollback (delete da row) para não deixar lixo órfão sem PDF.
- Confirmar visualmente que após "Enviar ao Plantão" o registro `analyses` tem `pdf_storage_path` preenchido e o objeto existe no bucket. Se não, o sintoma do usuário é real e só o log vai apontar a causa.
- Documentar no tooltip do "Meu Histórico" que **inserção manual** nunca terá PDF (já está implícito, mas tornar explícito).

Arquivos: `src/hooks/useAnalysis.ts`, `src/pages/Index.tsx`.

### 3. Inserção manual: direto para "Em Atendimento" com OIP/Autoridade da fila

**Comportamento atual** (`src/components/shift/OccurrencesTab.tsx`):
- Há uma fila local `pendingQueue` ("Aguardando registro"). O botão **"Adicionar à Fila"** insere ali. Para virar ocorrência real, precisa clicar em **"Registrar"** → abre o dialog → salva como `atendida` (concluída) direto.
- O botão **"Registrar Manualmente"** abre dialog vazio e também salva como `atendida`.
- Não há um caminho de "inserção manual → em atendimento".

**Mudança pedida**: substituir a fila intermediária ("Aguardando registro") por adicionar **diretamente em "Em Atendimento"**, já com OIP e Autoridade preenchidos pela fila preditiva (round-robin). O usuário depois clica em "Continuar" para preencher os campos e concluir.

**Implementação**:

1. Remover o estado `pendingQueue`, `skippedInvByIdx`, `skippedAuthByIdx`, `removePending`, `skipPendingInv`, `skipPendingAuth`, `registerPending` e a UI da seção "Aguardando registro".
2. Substituir o botão **"Adicionar à Fila"** por **"Adicionar à Em Atendimento"**: ao clicar, chama `onAdd({ status: "em_atendimento", bu_number, tramitation_time, investigator: suggestedInvestigator, authority: suggestedAuthority })`. A nova ocorrência aparece imediatamente no card "Em Atendimento", onde o usuário já pode pular OIP/Autoridade ou clicar em "Continuar".
3. Atualizar o contador da aba: `Em Distribuição ({inAttendance.length})` (não há mais `pendingQueue`).
4. Remover usos de `pendingQueue` em `predictSubteamQueue` / `predictQueue` — passar `[]` no lugar (a carga já é refletida pelas ocorrências reais agora).
5. Manter o botão **"Registrar Manualmente"** (`openNew`) que continua abrindo o dialog completo para registrar uma ocorrência **já atendida** retroativamente (caso de uso diferente).
6. Remover a limpeza de `pendingQueue` em `handleSave`.

Arquivos: `src/components/shift/OccurrencesTab.tsx`.

### Resumo dos arquivos editados

```text
src/components/ProcessingStatus.tsx       — só passos relevantes ao fluxo de triagem
src/types/analysis.ts                      — STEPS reduzidos / mensagens neutras
src/hooks/useAnalysis.ts                   — logs + rollback se upload falhar
src/pages/Index.tsx                        — tratamento de erro robusto na persistência
src/components/shift/OccurrencesTab.tsx    — remover pendingQueue, ir direto p/ Em Atendimento
```

Sem migrações de banco; sem mudança de RLS; sem novas tabelas.
