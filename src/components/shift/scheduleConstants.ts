// Presets de subequipe (turnos com descanso)
// Cada janela é uma faixa "HH:MM" — pode cruzar a meia-noite (end < start).

export type SchedulePresetId = "T1" | "T2" | "ISEO" | "CUSTOM";

export interface ScheduleWindow {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

export interface MemberSchedule {
  preset: SchedulePresetId;
  windows: ScheduleWindow[];
}

export interface SchedulePresetDef {
  id: SchedulePresetId;
  label: string;
  description: string;
  windows: ScheduleWindow[];
}

export const SCHEDULE_PRESETS: SchedulePresetDef[] = [
  {
    id: "T1",
    label: "Turno 1",
    description: "10:00–16:00 · descanso · 21:00–04:00",
    windows: [
      { start: "10:00", end: "16:00" },
      { start: "21:00", end: "04:00" },
    ],
  },
  {
    id: "T2",
    label: "Turno 2",
    description: "16:00–23:00 · descanso · 04:00–10:00",
    windows: [
      { start: "16:00", end: "23:00" },
      { start: "04:00", end: "10:00" },
    ],
  },
  {
    id: "ISEO",
    label: "ISEO (24h)",
    description: "Janela única, sem descanso",
    windows: [{ start: "00:00", end: "23:59" }],
  },
];

export const PRESET_BY_ID = Object.fromEntries(
  SCHEDULE_PRESETS.map((p) => [p.id, p]),
) as Record<SchedulePresetId, SchedulePresetDef>;

export function defaultScheduleFor(role?: string): MemberSchedule {
  if (role === "ISEO") return { preset: "ISEO", windows: PRESET_BY_ID.ISEO.windows };
  return { preset: "T1", windows: PRESET_BY_ID.T1.windows };
}

export function describeSchedule(s?: MemberSchedule | null): string {
  if (!s || !s.windows?.length) return "Sem horário";
  return s.windows.map((w) => `${w.start}–${w.end}`).join(" · ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Presets por categoria de subequipe (v5)
// ─────────────────────────────────────────────────────────────────────────────

export type SubteamCategory = "OIP" | "Delegado";
export type SubteamPresetId = "A" | "B" | "C" | "ISEO" | "CUSTOM";

export interface SubteamPresetDef {
  id: SubteamPresetId;
  label: string;
  description: string;
  windows: ScheduleWindow[];
}

// OIP — turnos fixos da equipe
export const OIP_PRESETS: SubteamPresetDef[] = [
  {
    id: "A",
    label: "A",
    description: "10:00–16:00 · 21:00–04:00",
    windows: [
      { start: "10:00", end: "16:00" },
      { start: "21:00", end: "04:00" },
    ],
  },
  {
    id: "B",
    label: "B",
    description: "16:00–21:00 · 04:00–10:00",
    windows: [
      { start: "16:00", end: "21:00" },
      { start: "04:00", end: "10:00" },
    ],
  },
  {
    id: "C",
    label: "C",
    description: "20:00–04:00",
    windows: [{ start: "20:00", end: "04:00" }],
  },
  {
    id: "CUSTOM",
    label: "Custom",
    description: "Janelas livres",
    windows: [{ start: "10:00", end: "16:00" }],
  },
];

// Delegado — somente custom (operador define janelas livremente).
export const DELEGADO_PRESETS: SubteamPresetDef[] = [
  {
    id: "CUSTOM",
    label: "Custom",
    description: "Janelas livres",
    windows: [{ start: "10:00", end: "22:00" }],
  },
];

export function getPresetsFor(category: SubteamCategory): SubteamPresetDef[] {
  return category === "OIP" ? OIP_PRESETS : DELEGADO_PRESETS;
}

export function findPreset(category: SubteamCategory, id: SubteamPresetId): SubteamPresetDef | undefined {
  return getPresetsFor(category).find((p) => p.id === id);
}
