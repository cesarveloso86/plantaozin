# Ajustes: Retenção do PDF e formato da Tipificação

## Problemas identificados

1. **PDF descartado prematuramente.** Hoje, em `src/hooks/useAnalysis.ts` (`generateFullFromAnalysis`), logo após gerar os depoimentos, o código remove o PDF do Storage e zera `pdf_storage_path`. Isso faz com que o servidor não consiga regerar/consultar o PDF dentro das 24h — contrariando a regra desejada (manter por 24h ou até deleção manual, o que ocorrer primeiro).
2. **Tipificação exportada com descrição completa.** Em `src/pages/Index.tsx`, ao enviar triagem ou análise completa para o plantão, o campo `tipification` da ocorrência é montado como `"Art. 33 - Tráfico de drogas; Art. 35 - Associação..."`. O usuário quer apenas os números dos artigos + leis correspondentes (ex.: `Art. 33 da Lei 11.343/06; Art. 35 da Lei 11.343/06`).

## Mudanças

### 1. Retenção do PDF por 24h (LGPD com janela mínima de operação)

**Arquivo:** `src/hooks/useAnalysis.ts` — função `generateFullFromAnalysis`

- Remover o trecho que apaga o PDF do bucket e o `pdf_storage_path` imediatamente após gerar a análise completa.
- O PDF passa a ser removido apenas:
  - automaticamente pela edge function `cleanup-expired-pdfs` (já existente, faz cutoff de 24h sobre `analyses.created_at`);
  - manualmente pelo próprio servidor, ao excluir a ocorrência/análise no "Meu Histórico".
- Após gerar depoimentos, manter `pdf_storage_path` populado para permitir regeração dentro da janela de 24h.

**Arquivo:** `src/pages/MeuHistorico.tsx`

- Ajustar o tooltip "PDF descartado" — quando há resultado completo mas o PDF ainda existe, exibir "Gerar depoimentos / Regerar" normalmente. O caso "PDF descartado" passa a aparecer apenas quando passou de 24h ou quando a ocorrência foi excluída.
- Atualizar copy do cabeçalho para deixar claro: "PDF disponível por até 24h após a triagem ou até exclusão manual."

**Exclusão manual:**
- Em `handleDeleteOne` e `handleClearAll`, antes de deletar a ocorrência, buscar `pdf_storage_path` das `analyses` vinculadas e remover do Storage (`supabase.storage.from("bo-pdfs").remove([...])`), zerando `pdf_storage_path`. Isso garante o "deletar antes de 24h se o servidor quiser".

### 2. Tipificação: apenas artigos + leis na ocorrência

**Arquivo:** `src/pages/Index.tsx`

Criar helper local:

```ts
const formatTipificacoesShort = (tips: Tipificacao[] = []) =>
  tips
    .map((t) => {
      const artigo = (t.artigo || "").trim();
      const lei = (t.lei || "").trim();
      if (!artigo) return "";
      return lei ? `${artigo} da ${lei}` : artigo;
    })
    .filter(Boolean)
    .join("; ");
```

- Em `buildOccurrenceFromTriage`: substituir o `map(... ` ${artigo} - ${descricao}`)` por `formatTipificacoesShort(t.tipificacoes_sugeridas)`.
- Em `handleSendFullToShift`: substituir o map atual de `result.despacho?.tipificacoes` por `formatTipificacoesShort(result.despacho?.tipificacoes)`.

A análise (tela de resultado e despacho) continua exibindo a descrição completa — só o que vai para o campo `tipification` da `shift_occurrences` muda.

### Observações

- Os textos descritivos completos seguem visíveis em `AnalysisResult.tsx` (despacho e lista de tipificações), inalterados.
- A edge function `cleanup-expired-pdfs` já implementa o corte de 24h — nenhuma mudança lá.
- RLS atual já permite ao OIP/Autoridade vinculados regerar dentro da janela.

## Arquivos a editar

- `src/hooks/useAnalysis.ts`
- `src/pages/Index.tsx`
- `src/pages/MeuHistorico.tsx`
