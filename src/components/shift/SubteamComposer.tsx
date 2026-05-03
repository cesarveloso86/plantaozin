import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, X, Trash2, ChevronUp, ChevronDown, UserCog, AlertTriangle } from "lucide-react";
import type { ShiftSubteam, ShiftMember } from "@/types/shift";
import {
  getPresetsFor,
  findPreset,
  iseoEndFromStart,
  type SubteamCategory,
  type SubteamPresetId,
  type ScheduleWindow,
} from "./scheduleConstants";
import { HourSelect } from "./HourSelect";

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

  const setMemberSubstituting = (subteamId: string, memberName: string, substituting: string | undefined) => {
    setSubteams((prev) =>
      prev.map((s) =>
        s.id === subteamId
          ? {
              ...s,
              members: s.members.map((m) =>
                m.name === memberName ? { ...m, substituting: substituting || undefined } : m,
              ),
            }
          : s,
      ),
    );
  };

  // Servidores cadastrados na unidade que NÃO estão escalados — candidatos a serem substituídos.
  const substitutableNames = useMemo(
    () => users.map((u) => u.full_name).filter((n) => !allSelectedNames.includes(n)),
    [users, allSelectedNames],
  );

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

      {eligibleUsers.length === 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
          <span className="text-foreground">
            Nenhum servidor com cargo {allowedCargos.join(" ou ")} cadastrado. Cadastre em <strong>Admin → Usuários</strong> ou <strong>Equipe Operacional</strong>.
          </span>
        </div>
      )}

      {subteams.length === 0 && eligibleUsers.length > 0 && (
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
                <Label className="text-xs text-muted-foreground">
                  {category === "ISEO" ? "Janela (8h fixas)" : "Janelas de trabalho"}
                </Label>
                {s.preset === "CUSTOM" && category !== "ISEO" && (
                  <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={() => addWindow(s.id)}>
                    <Plus className="w-3 h-3" /> janela
                  </Button>
                )}
              </div>
              {s.windows.map((w, wi) => {
                // ISEO: start é editável (em qualquer preset), end é sempre derivado.
                const startEditable = category === "ISEO" ? true : s.preset === "CUSTOM";
                const endEditable = category === "ISEO" ? false : s.preset === "CUSTOM";
                return (
                  <div key={wi} className="flex items-center gap-1.5">
                    <HourSelect
                      value={w.start}
                      onChange={(value) => updateWindow(s.id, wi, { start: value })}
                      className="h-7 text-xs w-[110px]"
                      disabled={!startEditable}
                    />
                    <span className="text-xs text-muted-foreground">→</span>
                    <HourSelect
                      value={w.end}
                      onChange={(value) => updateWindow(s.id, wi, { end: value })}
                      className="h-7 text-xs w-[110px]"
                      disabled={!endEditable}
                    />
                    {s.preset === "CUSTOM" && category !== "ISEO" && s.windows.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeWindow(s.id, wi)}>
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Membros */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Membros</Label>
              <Select onValueChange={(v) => addMember(s.id, v)} value="">
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder={`+ Adicionar ${catLabel}`} />
                </SelectTrigger>
                <SelectContent>
                  {availableForThis.length > 0 ? availableForThis.map((u) => (
                    <SelectItem key={u.id} value={u.id} className="text-xs">
                      {labelOf(u)}{u.nf ? ` — NF ${u.nf}` : ""}
                    </SelectItem>
                  )) : (
                    <SelectItem value="__empty" disabled className="text-xs text-muted-foreground">
                      Nenhum disponível
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {s.members.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {s.members.map((m) => (
                    <Badge key={m.name} variant="secondary" className="gap-1 pr-1 text-xs items-center">
                      <span>
                        {m.name}{m.nickname ? ` (${m.nickname})` : ""}{m.nf ? ` — NF ${m.nf}` : ""}
                        {m.substituting && (
                          <span className="ml-1 text-[10px] text-primary">· substitui {m.substituting}</span>
                        )}
                      </span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="ml-1 hover:text-primary"
                            title={m.substituting ? `Substitui ${m.substituting}` : "Marcar como substituindo outro servidor"}
                          >
                            <UserCog className="w-3 h-3" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2 space-y-2" align="start">
                          <Label className="text-xs">Está substituindo:</Label>
                          <Select
                            value={m.substituting || ""}
                            onValueChange={(v) => setMemberSubstituting(s.id, m.name, v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Selecionar servidor…" />
                            </SelectTrigger>
                            <SelectContent>
                              {substitutableNames.length > 0 ? substitutableNames.map((n) => (
                                <SelectItem key={n} value={n} className="text-xs">{n}</SelectItem>
                              )) : (
                                <SelectItem value="__empty" disabled className="text-xs">Nenhum disponível</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          {m.substituting && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-full text-xs"
                              onClick={() => setMemberSubstituting(s.id, m.name, undefined)}
                            >
                              <X className="w-3 h-3 mr-1" /> Limpar
                            </Button>
                          )}
                        </PopoverContent>
                      </Popover>
                      <button type="button" onClick={() => removeMember(s.id, m.name)} className="ml-0.5 hover:text-destructive" title="Remover">
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
