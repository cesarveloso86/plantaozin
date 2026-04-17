import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import type { ShiftSubteam, ShiftMember } from "@/types/shift";
import {
  getPresetsFor,
  findPreset,
  iseoEndFromStart,
  type SubteamCategory,
  type SubteamPresetId,
  type ScheduleWindow,
} from "./scheduleConstants";

interface UserProfile {
  id: string;
  full_name: string;
  nickname?: string | null;
  nf: string | null;
  cargo: string | null;
  role: string;
}

interface Props {
  category: SubteamCategory;
  title: string;
  subteams: ShiftSubteam[];
  setSubteams: React.Dispatch<React.SetStateAction<ShiftSubteam[]>>;
  users: UserProfile[];
  /** All names already chosen anywhere (across all subteams + iseo) — to prevent duplicates */
  allSelectedNames: string[];
  /** cargos elegíveis para esta categoria (filtro estrito) */
  allowedCargos: string[];
}

const labelOf = (u: UserProfile) =>
  u.nickname && u.nickname.trim() ? `${u.full_name} (${u.nickname})` : u.full_name;

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export function SubteamComposer({
  category,
  title,
  subteams,
  setSubteams,
  users,
  allSelectedNames,
  allowedCargos,
}: Props) {
  const presets = getPresetsFor(category);
  const lastHasMember = subteams.length === 0 || (subteams[subteams.length - 1].members.length > 0);

  const eligibleUsers = useMemo(
    () => users.filter((u) => u.cargo && allowedCargos.includes(u.cargo)),
    [users, allowedCargos],
  );

  const catLabel = category === "OIP" ? "OIP" : category === "Delegado" ? "Delegado" : "ISEO";

  const addSubteam = () => {
    const presetId: SubteamPresetId = category === "OIP" ? "A" : category === "ISEO" ? "ISEO_06" : "CUSTOM";
    const preset = findPreset(category, presetId)!;
    setSubteams((prev) => [
      ...prev,
      {
        id: newId(),
        label: `${catLabel} ${prev.length + 1}`,
        category,
        preset: presetId,
        windows: preset.windows.map((w) => ({ ...w })),
        members: [],
      },
    ]);
  };

  const removeSubteam = (id: string) => {
    setSubteams((prev) =>
      prev
        .filter((s) => s.id !== id)
        .map((s, i) => ({ ...s, label: `${catLabel} ${i + 1}` })),
    );
  };

  const moveSubteam = (idx: number, dir: -1 | 1) => {
    setSubteams((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      return copy.map((s, i) => ({ ...s, label: `${catLabel} ${i + 1}` }));
    });
  };

  const setPreset = (id: string, presetId: SubteamPresetId) => {
    setSubteams((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const p = findPreset(category, presetId);
        // Para CUSTOM, mantemos as janelas atuais; para presets fixos, sobrescrevemos.
        const windows = presetId === "CUSTOM" ? s.windows : (p?.windows.map((w) => ({ ...w })) ?? s.windows);
        return { ...s, preset: presetId, windows };
      }),
    );
  };

  const updateWindow = (id: string, idx: number, patch: Partial<ScheduleWindow>) => {
    setSubteams((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        // ISEO: ao alterar start, recalcula end = start + 8h automaticamente.
        if (category === "ISEO" && patch.start) {
          const newStart = patch.start;
          const newEnd = iseoEndFromStart(newStart);
          return { ...s, windows: [{ start: newStart, end: newEnd }] };
        }
        return { ...s, windows: s.windows.map((w, i) => (i === idx ? { ...w, ...patch } : w)) };
      }),
    );
  };

  const addWindow = (id: string) => {
    setSubteams((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, windows: [...s.windows, { start: "10:00", end: "16:00" }] } : s,
      ),
    );
  };

  const removeWindow = (id: string, idx: number) => {
    setSubteams((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, windows: s.windows.filter((_, i) => i !== idx) } : s,
      ),
    );
  };

  const addMember = (subteamId: string, userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    if (allSelectedNames.includes(user.full_name)) return;
    setSubteams((prev) =>
      prev.map((s) =>
        s.id === subteamId
          ? {
              ...s,
              members: [
                ...s.members,
                {
                  name: user.full_name,
                  nf: user.nf || undefined,
                  nickname: user.nickname || undefined,
                  role: category,
                  schedule: { preset: "CUSTOM", windows: s.windows.map((w) => ({ ...w })) },
                } as ShiftMember,
              ],
            }
          : s,
      ),
    );
  };

  const removeMember = (subteamId: string, name: string) => {
    setSubteams((prev) =>
      prev.map((s) =>
        s.id === subteamId ? { ...s, members: s.members.filter((m) => m.name !== name) } : s,
      ),
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">{title}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addSubteam}
          disabled={!lastHasMember}
          className="h-7 gap-1 text-xs"
          title={!lastHasMember ? "Adicione ao menos 1 membro à subequipe atual" : undefined}
        >
          <Plus className="w-3 h-3" /> Adicionar Subequipe
        </Button>
      </div>

      {subteams.length === 0 && (
        <p className="text-xs text-muted-foreground italic px-1">
          Nenhuma subequipe. Clique em "Adicionar Subequipe" para começar.
        </p>
      )}

      {subteams.map((s, idx) => {
        const availableForThis = eligibleUsers.filter((u) => !allSelectedNames.includes(u.full_name));
        return (
          <div key={s.id} className="border border-border rounded-md p-2.5 space-y-2 bg-muted/20">
            {/* Header */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-semibold">{s.label}</Badge>
              <div className="flex items-center gap-1 ml-auto">
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveSubteam(idx, -1)} disabled={idx === 0} title="Subir">
                  <ChevronUp className="w-3.5 h-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveSubteam(idx, 1)} disabled={idx === subteams.length - 1} title="Descer">
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeSubteam(s.id)} title="Remover">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Preset */}
            {presets.length > 1 && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground shrink-0">Preset:</Label>
                <Select value={s.preset} onValueChange={(v) => setPreset(s.id, v as SubteamPresetId)}>
                  <SelectTrigger className="h-7 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {presets.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.label} — {p.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Janelas */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Janelas de trabalho</Label>
                {s.preset === "CUSTOM" && (
                  <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={() => addWindow(s.id)}>
                    <Plus className="w-3 h-3" /> janela
                  </Button>
                )}
              </div>
              {s.windows.map((w, wi) => (
                <div key={wi} className="flex items-center gap-1.5">
                  <Input
                    type="time"
                    value={w.start}
                    onChange={(e) => updateWindow(s.id, wi, { start: e.target.value })}
                    className="h-7 text-xs w-[110px]"
                    disabled={s.preset !== "CUSTOM"}
                  />
                  <span className="text-xs text-muted-foreground">→</span>
                  <Input
                    type="time"
                    value={w.end}
                    onChange={(e) => updateWindow(s.id, wi, { end: e.target.value })}
                    className="h-7 text-xs w-[110px]"
                    disabled={s.preset !== "CUSTOM"}
                  />
                  {s.preset === "CUSTOM" && s.windows.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeWindow(s.id, wi)}>
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Membros */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Membros</Label>
              <Select onValueChange={(v) => addMember(s.id, v)} value="">
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder={`+ Adicionar ${category === "OIP" ? "OIP" : "Delegado"}`} />
                </SelectTrigger>
                <SelectContent>
                  {availableForThis.length > 0 ? availableForThis.map((u) => (
                    <SelectItem key={u.id} value={u.id} className="text-xs">
                      {labelOf(u)}{u.nf ? ` — NF ${u.nf}` : ""}
                    </SelectItem>
                  )) : (
                    <SelectItem value="__empty" disabled className="text-xs text-muted-foreground">
                      Nenhum {category} disponível
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {s.members.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {s.members.map((m) => (
                    <Badge key={m.name} variant="secondary" className="gap-1 pr-1 text-xs">
                      {m.name}{m.nickname ? ` (${m.nickname})` : ""}{m.nf ? ` — NF ${m.nf}` : ""}
                      <button type="button" onClick={() => removeMember(s.id, m.name)} className="ml-1 hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Flatten subteams into ShiftMember[] with windows from the parent subteam. */
export function flattenSubteams(subteams: ShiftSubteam[]): ShiftMember[] {
  const out: ShiftMember[] = [];
  for (const s of subteams) {
    for (const m of s.members) {
      out.push({
        ...m,
        schedule: { preset: "CUSTOM" as const, windows: s.windows.map((w) => ({ ...w })) },
      });
    }
  }
  return out;
}
