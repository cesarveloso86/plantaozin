
# Plano v5 — Subequipes separadas (Delegado / OIP) + fila real-time

## 1. Subequipes independentes por categoria

Cada categoria tem suas próprias subequipes, com janelas próprias.

### 1a. Modelo
Em `src/types/shift.ts`:
```ts
export interface ShiftSubteam {
  id: string;
  label: string;            // "OIP 1", "Delegado 1"
  category: 'OIP' | 'Delegado';
  preset: string;           // 'A'|'B'|'C'|'CUSTOM'
  windows: ScheduleWindow[];
  members: ShiftMember[];
}

export interface Shift {
  // ...
  oip_subteams: ShiftSubteam[];
  delegado_subteams: ShiftSubteam[];
  // authorities/investigators continuam derivados (flatten) p/ compat
}
```

### 1b. Presets (`scheduleConstants.ts`)
- **OIP_PRESETS**: A `10–16 + 21–04`, B `16–21 + 04–10`, C `20–04`, CUSTOM.
- **DELEGADO_PRESETS**: CUSTOM apenas (livre — geralmente duplas em 3–4 subequipes, sem janela fixa). Operador define janelas livremente.
- API utilitária: `getPresetsFor(category)`.

### 1c. Persistência
Migration:
```sql
ALTER TABLE shifts ADD COLUMN oip_subteams jsonb NOT NULL DEFAULT '[]';
ALTER TABLE shifts ADD COLUMN delegado_subteams jsonb NOT NULL DEFAULT '[]';
```
Save: grava as duas colunas + flatten em `investigators`/`authorities` (compat). Read: se ambas vazias → reconstrói "Subequipe Legada" a partir dos arrays planos para edição.

## 2. UX de criação — `SubteamComposer`

Substitui os 3 `MemberSelector` planos no `CreateShiftDialog`/`EditShiftDialog` por **dois compositores empilhados** + ISEO à parte.

```text
┌─ Subequipes de OIPs ─────────────────────┐
│ [+ Adicionar Subequipe OIP]              │
│ ┌─ OIP 1 · Preset (•)A ( )B ( )C ( )Cust │
│ │  Janelas: 10:00–16:00 · 21:00–04:00    │
│ │  Membros: [+ add OIP]  • Victor [×]    │
│ └────────────────────────────────────────┘
└──────────────────────────────────────────┘
┌─ Subequipes de Delegados ────────────────┐
│ [+ Adicionar Subequipe Delegado]         │
│ ┌─ Delegado 1 · Janelas custom           │
│ │  [HH:MM]–[HH:MM]  [+ janela]           │
│ │  Membros: [+ add Delegado] • Aldari [×]│
│ └────────────────────────────────────────┘
└──────────────────────────────────────────┘
ISEO (24h, qualquer cargo): [selector]
```

Regras:
- Filtro estrito por `cargo` no select de membros (OIP só lista OIPs; Delegado só Delegados/Autoridades).
- Botão "Adicionar Subequipe" só habilita após a anterior ter ≥1 membro.
- Ordem das subequipes = ordem inicial da fila preditiva (drag ↑↓).

**Componente**: `src/components/shift/SubteamComposer.tsx` (parametrizado por `category`).

## 3. Fila preditiva real-time

### 3a. Hook `useNow`
`src/hooks/useNow.ts` — `Date` atualizado a cada 30 s. Forçar recompute de disponibilidade ao virar janela.

### 3b. `predictSubteamQueue` em `availability.ts`
Para cada categoria (OIP, Delegado), separadamente:
1. Filtra subequipes com ≥1 janela ativa em `now`.
2. Carga = `occurrences.atendida + pending` atribuídos a qualquer membro da subequipe + a subequipes que skipped no slot atual penalizadas.
3. Pick: menor carga; empate → menor `index` cadastrado.
4. Skipped (regra v3) vai para o final.
5. Retorna lista `[{ subteamId, label, memberPick }]`.

### 3c. Real-time no UI
`OccurrencesTab.tsx`:
- Substitui `predictQueue` plana por `predictSubteamQueue` chamada com `useNow()`.
- Realtime do Supabase já dispara reload de `occurrences` → fila recalcula a cada `INSERT/UPDATE/DELETE`.
- Ao **selecionar** o investigador/autoridade num slot pendente (ou ao registrar/concluir): estado local `pendingQueue` muda → `useMemo([occurrences, pending, now])` recompute imediato → fila "anda" sem refresh.
- Badge discreto "Atualizado HH:MM:SS" no topo do bloco de fila.

## 4. Arquivos
**Migration**: `shifts.oip_subteams` + `shifts.delegado_subteams` (jsonb)
**Criar**: `src/components/shift/SubteamComposer.tsx`, `src/hooks/useNow.ts`
**Editar**:
- `src/types/shift.ts` (+ `ShiftSubteam`, campos no `Shift`)
- `src/components/shift/scheduleConstants.ts` (presets por categoria)
- `src/components/shift/CreateShiftDialog.tsx` + `EditShiftDialog.tsx` (dois SubteamComposers)
- `src/lib/availability.ts` (`predictSubteamQueue`)
- `src/components/shift/OccurrencesTab.tsx` (`useNow`, fila por subequipe, recompute em mudança de pending)
- `src/hooks/useShift.ts` (persistir/ler subequipes, fallback legado)
- `src/components/shift/ResumoTab.tsx` (exibir subequipes agrupadas)

## Ordem
1. Migration + types
2. `scheduleConstants` por categoria
3. `SubteamComposer` + integração nos dialogs
4. `predictSubteamQueue` + `useNow` + recompute real-time em `OccurrencesTab`
5. `ResumoTab` agrupado por subequipe
