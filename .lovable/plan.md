## Correções no fluxo de plantão

### 1. Dropdowns de membros em tempo real
**Arquivo:** `src/hooks/useTeamMembers.ts`

Hoje `useAllShiftMembers(enabled)` só carrega `profiles` + `team_members` quando o diálogo abre. Quando um admin cadastra novo usuário em outra aba (ou na mesma sessão sem fechar tudo), o cache não atualiza.

- Adicionar subscrição Supabase Realtime nas tabelas `profiles` e `team_members` dentro do hook. Em qualquer evento (`INSERT`/`UPDATE`/`DELETE`), chamar `load()` para revalidar.
- Migration: garantir que ambas as tabelas estejam na publicação:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
  ALTER TABLE public.profiles REPLICA IDENTITY FULL;
  ALTER TABLE public.team_members REPLICA IDENTITY FULL;
  ```
- Desinscrever no cleanup do `useEffect`.

Resultado: ao incluir novo servidor em `AdminUsuarios`, o `CreateShiftDialog`/`EditShiftDialog` aberto refletirá o membro sem precisar fechar o plantão.

### 2. XLSX: exportar apenas o apelido
**Arquivo:** `src/lib/exportXlsx.ts`

A função `exportShiftXlsx` recebe `Shift` (que já contém `investigators`/`authorities` com `nickname`). Mudanças:

- Construir um `Map<string,string>` de `full_name → nickname` a partir de `shift.investigators`, `shift.authorities` e `shift.iseo`.
- Helper `displayLabel(name)` que devolve `nickname` quando existir, senão o nome completo.
- Aplicar nas colunas "OFICIAL INVESTIGADOR DE POLÍCIA" e "AUTORIDADE POLICIAL" da planilha principal e na aba "Por OIP" (chave de agregação continua sendo o `full_name` armazenado, mas o rótulo exibido será o apelido).

### 3. Auto-preenchimento de OIP/Autoridade ao enviar ocorrência
**Arquivo:** `src/pages/Index.tsx`

Hoje `handleSendTriageToShift` e `handleSendFullToShift` criam a ocorrência sem `investigator`/`authority`, deixando vazio na aba "Em Atendimento".

- Importar `predictSubteamQueue`/`predictQueue` de `@/lib/availability` (mesma lógica usada em `OccurrencesTab`).
- Antes do `addOccurrence`, calcular o 1º nome sugerido considerando subequipes ativas + ocorrências já atendidas/pendentes do `shift.activeShift`:
  - `suggestedInv = predictSubteamQueue(oip_subteams, completed, [], "investigator", 1, now)[0]?.memberPick ?? predictQueue(investigators, completed, [], "investigator", 1, now)[0] ?? ""`
  - mesmo para `authority` com `delegado_subteams`/`authorities`.
- Passar `investigator: suggestedInv, authority: suggestedAuth` para `shift.addOccurrence`.
- Comportamento de "pular a vez" continua via botão `SkipForward` já existente em "Em Atendimento".

### 4. Gerar depoimentos só em "Meu Histórico"
A funcionalidade já existe em `MeuHistorico.tsx` (linhas 295–307) e também duplicada em `OccurrencesTab.tsx` (linhas 79–97 e botão 494–507). Vamos:

**a) Manter e reforçar em `src/pages/MeuHistorico.tsx`:** já está OK — botão "Gerar depoimentos" aparece quando `pdf_storage_path` existe; "Ver depoimentos" quando `has_full_result`. Nenhuma mudança necessária além de:
   - Garantir que o card explique a janela de 24h (texto já presente).

**b) Remover de `src/components/shift/OccurrencesTab.tsx`:**
   - Apagar `handleGenerateDepoimentos`, estados `generatingFor`, `fullResult`, `resultOpen` e o `Dialog` de resultado.
   - Remover o botão "Gerar depoimentos" do bloco "Em Atendimento" (linhas 494–507).
   - Remover imports não usados (`useAnalysis`, `AnalysisResultView`, `Sparkles`, `Loader2`, `AnalysisResult`).

**c) Por que o PDF "não fica acessível"?**
A causa real é que o usuário tentava gerar a partir de "Em Atendimento" mas naquele momento o `analysis_id` da ocorrência criada via `handleSendTriageToShift` está vinculado a um registro `analyses` que **tem** `pdf_storage_path` válido (≤24h). Ao consolidar tudo em "Meu Histórico", o usuário enxerga o estado correto: PDF disponível → botão "Gerar"; PDF expirado → tooltip "PDF expirado"; já gerado → "Ver depoimentos". Sem duplicação confusa.

### Detalhes técnicos

```text
Realtime hook (resumo)
┌─ useAllShiftMembers(enabled) ────────────┐
│ useEffect(load, [enabled])               │
│ useEffect(channel.subscribe('profiles'   │
│   + 'team_members') → load on change)    │
└──────────────────────────────────────────┘

Auto-fill no Index
triageResult → resolveRegional → predictNext(OIP/Autoridade)
            → addOccurrence({ ..., investigator, authority })
```

### Arquivos editados
- `src/hooks/useTeamMembers.ts` (realtime)
- `supabase/migrations/<novo>.sql` (publicação realtime)
- `src/lib/exportXlsx.ts` (apelido)
- `src/pages/Index.tsx` (auto-fill)
- `src/components/shift/OccurrencesTab.tsx` (remover gerar depoimentos)

### Fora do escopo
- Não alteramos retenção de PDF (continua 24h).
- Não mexemos em `MeuHistorico.tsx` (funcionalidade já correta).
