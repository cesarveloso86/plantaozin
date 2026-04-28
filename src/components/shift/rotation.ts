import type { ShiftSubteam, ShiftMember } from "@/types/shift";
import type { SubteamPresetId } from "./scheduleConstants";

/**
 * Regras de rotação por equipe.
 * - shift: gira presets em carrossel (preset[0] → preset[1] → ... → preset[0])
 * - rotateInternal: gira a ordem dos membros dentro da subequipe (1º vira último)
 * - shift+rotateInternal: aplica os dois
 * - none: mantém igual
 */
export type RotationStrategy = "shift" | "rotateInternal" | "shift+rotateInternal" | "none";

export interface CategoryRule {
  strategy: RotationStrategy;
  /** Ordem do carrossel de presets. Subequipe que está em presets[i] vai pra presets[(i+1) % n]. */
  presets?: SubteamPresetId[];
}

export interface TeamRule {
  delegado: CategoryRule;
  oip: CategoryRule;
  iseo: CategoryRule;
}

/** Padrão genérico — aplicado a qualquer equipe que não tenha regra específica. */
export const DEFAULT_TEAM_RULE: TeamRule = {
  delegado: { strategy: "rotateInternal" },
  oip: { strategy: "shift+rotateInternal", presets: ["A", "B", "C"] },
  iseo: { strategy: "rotateInternal" },
};

/**
 * Regras por equipe. Pode ser ajustado conforme regras reais de cada equipe.
 * Hoje usa o padrão para todas — pronto para customizar A-E individualmente.
 */
export const TEAM_RULES: Record<string, TeamRule> = {
  "Equipe A": DEFAULT_TEAM_RULE,
  "Equipe B": DEFAULT_TEAM_RULE,
  "Equipe C": DEFAULT_TEAM_RULE,
  "Equipe D": DEFAULT_TEAM_RULE,
  "Equipe E": DEFAULT_TEAM_RULE,
};

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** Carrossel: shift presets[i] → presets[(i+1) % n]. Mantém label/categoria. */
function shiftPreset(currentPreset: SubteamPresetId, presets?: SubteamPresetId[]): SubteamPresetId {
  if (!presets || presets.length === 0) return currentPreset;
  const idx = presets.indexOf(currentPreset);
  if (idx === -1) return currentPreset;
  return presets[(idx + 1) % presets.length];
}

/** Primeiro membro vai pro fim. */
function rotateMembers<T>(members: T[]): T[] {
  if (members.length <= 1) return [...members];
  return [...members.slice(1), members[0]];
}

import { findPreset, type SubteamCategory } from "./scheduleConstants";

function applyToCategory(
  subteams: ShiftSubteam[],
  rule: CategoryRule,
  category: SubteamCategory,
  catLabel: string,
): ShiftSubteam[] {
  return subteams.map((s, i) => {
    const doShift = rule.strategy === "shift" || rule.strategy === "shift+rotateInternal";
    const doRotate = rule.strategy === "rotateInternal" || rule.strategy === "shift+rotateInternal";

    let preset = s.preset;
    let windows = s.windows.map((w) => ({ ...w }));
    if (doShift) {
      preset = shiftPreset(s.preset, rule.presets);
      const presetDef = findPreset(category, preset);
      if (presetDef && preset !== "CUSTOM") {
        windows = presetDef.windows.map((w) => ({ ...w }));
      }
    }

    const members: ShiftMember[] = doRotate ? rotateMembers(s.members) : [...s.members];

    return {
      id: newId(),
      label: `${catLabel} ${i + 1}`,
      category: s.category,
      preset,
      windows,
      members: members.map((m) => ({ ...m, schedule: { preset: "CUSTOM" as const, windows: windows.map((w) => ({ ...w })) } })),
    };
  });
}

export interface RotatedPayload {
  oip_subteams: ShiftSubteam[];
  delegado_subteams: ShiftSubteam[];
  iseo_subteams: ShiftSubteam[];
}

/** Aplica a rotação ao último plantão e devolve as subequipes prontas pro novo plantão. */
export function applyRotation(
  last: { oip_subteams: ShiftSubteam[]; delegado_subteams: ShiftSubteam[]; iseo_subteams: ShiftSubteam[] },
  rule: TeamRule,
): RotatedPayload {
  return {
    delegado_subteams: applyToCategory(last.delegado_subteams || [], rule.delegado, "Delegado", "Delegado"),
    oip_subteams: applyToCategory(last.oip_subteams || [], rule.oip, "OIP", "OIP"),
    iseo_subteams: applyToCategory(last.iseo_subteams || [], rule.iseo, "ISEO", "ISEO"),
  };
}

export function getTeamRule(teamName: string): TeamRule {
  return TEAM_RULES[teamName] || DEFAULT_TEAM_RULE;
}
