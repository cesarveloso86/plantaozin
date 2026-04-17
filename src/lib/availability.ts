import type { ShiftMember, ShiftOccurrence, ShiftSubteam } from "@/types/shift";
import type { ScheduleWindow } from "@/components/shift/scheduleConstants";

// HH:MM → minutos do dia
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
}

function dateToMinutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

// Janela cruza a meia-noite (ex.: 21:00→04:00) se end <= start
export function isInWindow(window: ScheduleWindow, when: Date): boolean {
  const cur = dateToMinutes(when);
  const s = toMinutes(window.start);
  const e = toMinutes(window.end);
  if (s === e) return false;
  if (s < e) return cur >= s && cur < e;
  return cur >= s || cur < e;
}

export function isSubteamActive(subteam: ShiftSubteam, when: Date): boolean {
  if (!subteam.windows?.length) return false;
  return subteam.windows.some((w) => isInWindow(w, when));
}

export function isAvailable(member: ShiftMember, when: Date = new Date()): boolean {
  const sched = member.schedule;
  if (!sched || !sched.windows?.length) return true;
  return sched.windows.some((w) => isInWindow(w, when));
}

export function getAvailableMembers(members: ShiftMember[], when: Date = new Date()): ShiftMember[] {
  return members.filter((m) => isAvailable(m, when));
}

interface PendingLike {
  investigator?: string;
  authority?: string;
}

function buildLoadMap(
  members: string[],
  occurrences: ShiftOccurrence[],
  pending: PendingLike[],
  field: "investigator" | "authority",
): Record<string, number> {
  const counts: Record<string, number> = {};
  members.forEach((m) => (counts[m] = 0));
  occurrences.forEach((o) => {
    const v = o[field];
    if (v && counts[v] !== undefined) counts[v]++;
  });
  pending.forEach((p) => {
    const v = p[field];
    if (v && counts[v] !== undefined) counts[v]++;
  });
  return counts;
}

export function predictQueue(
  members: ShiftMember[],
  occurrences: ShiftOccurrence[],
  pending: PendingLike[],
  field: "investigator" | "authority",
  count = 5,
  when: Date = new Date(),
  skipped: string[] = [],
): string[] {
  const available = getAvailableMembers(members, when).map((m) => m.name);
  if (available.length === 0) return [];

  const skipSet = new Set(skipped);
  const head = available.filter((n) => !skipSet.has(n));
  const tail = available.filter((n) => skipSet.has(n));
  const ordered = [...head, ...tail];

  const counts = buildLoadMap(ordered, occurrences, pending, field);
  const SKIP_PENALTY = 1_000_000;
  for (const n of skipped) counts[n] = (counts[n] ?? 0) + SKIP_PENALTY;

  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    let pick = ordered[0];
    let min = Infinity;
    for (const name of ordered) {
      if (counts[name] < min) {
        min = counts[name];
        pick = name;
      }
    }
    result.push(pick);
    counts[pick]++;
  }
  return result;
}

export function nextSkipping(
  members: ShiftMember[],
  current: string,
  when: Date = new Date(),
  extraSkipped: string[] = [],
): string {
  const available = getAvailableMembers(members, when).map((m) => m.name);
  if (available.length === 0) return "";
  const skipSet = new Set([current, ...extraSkipped].filter(Boolean));
  const next = available.find((n) => !skipSet.has(n));
  if (!next) {
    const idx = available.indexOf(current);
    return idx < 0 ? available[0] : available[(idx + 1) % available.length];
  }
  return next;
}

// ─────────────────────────────────────────────────────────────────────────────
// v5 — Fila preditiva por subequipe
// ─────────────────────────────────────────────────────────────────────────────

export interface SubteamQueueItem {
  subteamId: string;
  subteamLabel: string;
  memberPick: string;
}

/**
 * Para cada categoria, escolhe a próxima subequipe ativa com menor carga,
 * e dentro dela o membro disponível com menor carga (round-robin interno).
 * `skippedSubteams` empurra subequipes para o final na rodada atual.
 */
export function predictSubteamQueue(
  subteams: ShiftSubteam[],
  occurrences: ShiftOccurrence[],
  pending: PendingLike[],
  field: "investigator" | "authority",
  count = 5,
  when: Date = new Date(),
  skippedSubteams: string[] = [],
): SubteamQueueItem[] {
  const active = subteams.filter((s) => isSubteamActive(s, when));
  if (active.length === 0) return [];

  // Carga acumulada por subequipe = soma de atendimentos atribuídos a qualquer membro dela.
  const loadBySubteam: Record<string, number> = {};
  // Carga por membro (para escolha interna).
  const loadByMember: Record<string, number> = {};
  active.forEach((s) => {
    loadBySubteam[s.id] = 0;
    s.members.forEach((m) => (loadByMember[m.name] = 0));
  });

  const tally = (name?: string | null) => {
    if (!name) return;
    if (loadByMember[name] !== undefined) loadByMember[name]++;
    for (const s of active) {
      if (s.members.some((m) => m.name === name)) {
        loadBySubteam[s.id]++;
        break;
      }
    }
  };
  occurrences.forEach((o) => tally(o[field]));
  pending.forEach((p) => tally(p[field]));

  // Penalidade para subequipes skipped.
  const SKIP_PENALTY = 1_000_000;
  for (const sid of skippedSubteams) {
    if (loadBySubteam[sid] !== undefined) loadBySubteam[sid] += SKIP_PENALTY;
  }

  // Ordem de cadastro (índice) para desempate.
  const indexOf = new Map(active.map((s, i) => [s.id, i]));

  const result: SubteamQueueItem[] = [];
  for (let i = 0; i < count; i++) {
    // Pick subequipe: menor carga, desempate por índice.
    let pickedSubteam = active[0];
    let minLoad = Infinity;
    for (const s of active) {
      const l = loadBySubteam[s.id];
      if (l < minLoad || (l === minLoad && (indexOf.get(s.id) ?? 0) < (indexOf.get(pickedSubteam.id) ?? 0))) {
        minLoad = l;
        pickedSubteam = s;
      }
    }
    // Pick membro dentro da subequipe: menor carga.
    let pickedMember = pickedSubteam.members[0]?.name || "";
    let minMember = Infinity;
    for (const m of pickedSubteam.members) {
      const l = loadByMember[m.name] ?? 0;
      if (l < minMember) {
        minMember = l;
        pickedMember = m.name;
      }
    }
    result.push({
      subteamId: pickedSubteam.id,
      subteamLabel: pickedSubteam.label,
      memberPick: pickedMember,
    });
    loadBySubteam[pickedSubteam.id]++;
    if (pickedMember) loadByMember[pickedMember] = (loadByMember[pickedMember] ?? 0) + 1;
  }
  return result;
}
