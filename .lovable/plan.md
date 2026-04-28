## Ajustes no Wizard de Criação de Plantão

Três correções pontuais no `CreateShiftDialog`, sem mexer em schema, RLS ou hooks de ocorrência.

---

### 1. Passo 2 — Aba "OIPs" funcional e visível

**Diagnóstico:** a aba existe (`SubteamComposer` com `allowedCargos=["OIP"]`), e o cargo "OIP" está cadastrado no banco. O que provavelmente está faltando é deixar claro na UI quando a equipe selecionada **não tem nenhum OIP elegível** (lista vazia → usuário acha que sumiu).

**Mudanças em `SubteamComposer.tsx`:**
- Quando `eligibleUsers.length === 0`, mostrar um aviso curto acima do botão "Adicionar Subequipe": *"Nenhum servidor com cargo OIP cadastrado. Cadastre em Admin → Usuários ou Equipe Operacional."*
- Tornar a aba "OIPs" no `Tabs` do passo 2 igualmente prominente (já está — confirmar que o `defaultValue` permite o usuário trocar pra "oip" sem fricção; manter `activeTab` controlado, ok).

**Resultado:** se a equipe não tem OIPs cadastrados, o usuário entende o motivo em vez de achar que a feature sumiu.

---

### 2. Reintroduzir "substituindo outro servidor"

O campo `substituting?: string` já existe em `ShiftMember`. Sumiu da UI. Reintroduzir de forma mínima no `SubteamComposer`:

- Em cada badge de membro adicionado à subequipe, um botão pequeno (ícone `UserCog` ou texto "subst.") abre um `Popover` com um `Select` listando **todos os servidores cadastrados na unidade** (profiles + team_members) **que não estão escalados** neste plantão.
- Ao escolher, grava `m.substituting = nome` e o badge passa a mostrar `Nome (substitui X)`.
- Botão `X` no popover limpa o campo.

**Onde o dado é usado:** já é serializado em `oip_subteams`/`delegado_subteams`/`iseo_subteams` via JSONB; o `flattenSubteams` precisa propagar `substituting`. Ajuste de uma linha.

---

### 3. AbsenceSelector — dropdown com todos os servidores da unidade

**Hoje:** `scheduledMembers` (só os escalados no plantão atual).
**Mudança:** trocar a fonte para `useAllShiftMembers(open)` direto dentro do componente OU receber `allUnitMembers: string[]` como prop.

**Implementação escolhida** (menos refactor): passar `allUnitMembers` do `CreateShiftDialog` para o `AbsenceSelector`:

```tsx
// CreateShiftDialog.tsx
const allUnitNames = users.map((u) => u.full_name);

<AbsenceSelector
  absences={absences}
  setAbsences={setAbsences}
  availableNames={allUnitNames}   // renomeado para refletir o novo significado
/>
```

```tsx
// AbsenceSelector.tsx
interface Props {
  absences: ShiftAbsence[];
  setAbsences: (a: ShiftAbsence[]) => void;
  availableNames: string[];   // todos os servidores da unidade
}
// available = availableNames.filter(n => !absentNames.includes(n))
```

**Resultado:** o usuário pode marcar como ausente qualquer servidor cadastrado, mesmo que não tenha sido escalado naquele plantão — sem precisar pré-cadastrar na escala.

---

### Arquivos alterados

- `src/components/shift/SubteamComposer.tsx` — aviso de "nenhum elegível" + popover de "substitui"; `flattenSubteams` propaga `substituting`.
- `src/components/shift/AbsenceSelector.tsx` — prop renomeada (`scheduledMembers` → `availableNames`), filtro ajustado.
- `src/components/shift/CreateShiftDialog.tsx` — passar `users.map(u => u.full_name)` para o `AbsenceSelector`.

### O que NÃO muda

- Schema do banco, RLS, edge functions.
- `EditShiftDialog` (escopo é só a criação, conforme pedido).
- Lógica de rotação, presets, ISEO 8h.
- Hooks de ocorrências, exports, cleanup de PDFs.