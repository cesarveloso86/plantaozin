## Plano de correção

### 1. "PDF expirado" no Meu Histórico — causa raiz identificada

**Bug**: a tabela `analyses` **não tem** uma policy `UPDATE` para o próprio dono. As policies existentes só permitem UPDATE para OIP/Autoridade vinculados via `shift_occurrences`. Quando `persistTriageForShift` (em `useAnalysis.ts`) faz:

```ts
INSERT analyses (user_id = auth.uid(), pdf_storage_path = null)  -- ✅ OK
upload bo-pdfs/{user}/{id}.pdf                                   -- ✅ OK
UPDATE analyses SET pdf_storage_path = '...' WHERE id = ...      -- ❌ 0 rows (RLS bloqueia)
```

O Supabase JS client **não retorna erro** em UPDATE que afeta 0 linhas — só atualiza nada. Resultado: `pdf_storage_path` permanece `null` para sempre, o tooltip mostra "PDF expirado".

**Fix (migração)**:

```sql
CREATE POLICY "Users can update own analyses"
ON public.analyses
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

Também aplicar `ALTER TABLE public.shift_occurrences REPLICA IDENTITY FULL;` para garantir payloads de realtime completos.

### 2. Inserção manual não aparece em tempo real na fila "Em Atendimento"

**Bug**: `addOccurrence` em `src/hooks/useShift.ts` só faz `INSERT` e confia no realtime para popular o estado local. Se o realtime atrasar/falhar, a UI fica vazia até o próximo reload. Além disso, `select().single()` não é chamado, então o registro inserido não é retornado.

**Fix em `src/hooks/useShift.ts`**:
- `addOccurrence` passa a usar `.insert(...).select().single()`.
- Atualiza `setOccurrences` otimisticamente (com guard contra duplicar quando o realtime chegar depois).

### 3. Botão "Registrar Manualmente" duplicado

Em `src/components/shift/OccurrencesTab.tsx`, há dois caminhos para registrar uma ocorrência:
1. Inserir BU + horário no inline form → "Adicionar à Em Atendimento" (cria direto).
2. Botão "Registrar Manualmente" → abre dialog modal e salva como **atendida** (concluída) já preenchida.

O fluxo (1) já cobre todos os casos: o usuário insere, vai pra fila, clica em "Continuar" no card e edita os campos. O caminho (2) é redundante.

**Fix**: remover o botão "Registrar Manualmente" e a função `openNew()`. O `<Dialog>` permanece para o fluxo de **edição/continuar** (que ainda é necessário). O dialog também atende edição de ocorrências já atendidas.

### 4. Análise + BU duplicado: mesclar campos faltantes em vez de bloquear

Em `src/pages/Index.tsx`, `handleSendTriageToShift` hoje rejeita com `toast.error("BU já está em distribuição/atendida")` se houver duplicata. O usuário pediu para, em vez de rejeitar, **completar os campos vazios** da ocorrência existente com os dados da análise.

**Fix em `src/pages/Index.tsx`**:
- Quando `findExistingBu` encontra a ocorrência, em vez de cancelar:
  - Construir o objeto da triagem (`buildOccurrenceFromTriage`).
  - Chamar `shift.updateOccurrence(existing.id, mergeFields)` onde `mergeFields` contém apenas chaves cujo valor atual está vazio (ou é null/""). Não sobrescreve OIP/Autoridade nem horário já preenchidos.
  - Se a ocorrência existente já tinha `analysis_id`, NÃO criar uma nova análise (reaproveita a existente). Se não tinha, persiste a triagem nova e linka via update do `analysis_id`.
- Toast: "Ocorrência {bu} atualizada com dados da análise".

Aplicar a mesma lógica em `handleSendFullToShift`.

### 5. Logs de debug (já presentes em `useAnalysis.ts`)

Os logs adicionados na iteração anterior em `persistTriageForShift` ajudarão a confirmar o fix do (1). Manter.

### Resumo dos arquivos

```text
supabase/migrations/<timestamp>_users_update_own_analyses.sql  — nova policy UPDATE + REPLICA IDENTITY
src/hooks/useShift.ts                                           — addOccurrence otimista
src/components/shift/OccurrencesTab.tsx                         — remover botão "Registrar Manualmente"
src/pages/Index.tsx                                             — merge em vez de rejeitar BU duplicado
```

Sem mudanças em edge functions, tipos ou outros arquivos.
