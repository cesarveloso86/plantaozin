import type { ShiftMember, ShiftOccurrence } from "@/types/shift";
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

export function isAvailable(member: ShiftMember, when: Date = new Date()): boolean {
  const sched = member.schedule;
  if (!sched || !sched.windows?.length) return true; // sem horário definido = sempre disponível
  return sched.windows.some((w) => isInWindow(w, when));
}

export function getAvailableMembers(members: ShiftMember[], when: Date = new Date()): ShiftMember[] {
  return members.filter((m) => isAvailable(m, when));
}

interface PendingLike {
  investigator?: string;
  authority?: string;
}

/**
 * Conta atendimentos por nome em ocorrências + pendentes.
 */
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

/**
 * Prediz a ordem dos próximos `count` atendimentos para um papel,
 * considerando apenas membros disponíveis no horário `when`.
 * Round-robin ponderado: a cada passo escolhe quem tem menor carga (desempate por ordem original).
 */
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

  // Skipped vão para o final: prioridade = quem não foi pulado primeiro.
  const skipSet = new Set(skipped);
  const head = available.filter((n) => !skipSet.has(n));
  const tail = available.filter((n) => skipSet.has(n));
  const ordered = [...head, ...tail];

  const counts = buildLoadMap(ordered, occurrences, pending, field);
  // Boost na carga de skipped para empurrá-los ao final mesmo com menor carga real.
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

/**
 * Próximo da fila pulando o atual: empurra `current` para o fim e devolve o 1º não-pulado.
 * `extraSkipped` permite manter um histórico de pulados acumulado.
 */
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
  // Se todos estão pulados, volta ao próximo cíclico do current.
  if (!next) {
    const idx = available.indexOf(current);
    return idx < 0 ? available[0] : available[(idx + 1) % available.length];
  }
  return next;
}
