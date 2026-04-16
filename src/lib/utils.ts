import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converte uma string `YYYY-MM-DD` (Postgres `date`) para Date local,
 * evitando o off-by-one causado por `new Date("YYYY-MM-DD")` (parse UTC).
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Formata `YYYY-MM-DD` como pt-BR sem deslocamento de fuso. */
export function formatLocalDateBR(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString("pt-BR");
}
