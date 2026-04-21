// App-wide constants
import { REGIONALS } from "@/types/shift";

export const ALLOWED_EMAIL_DOMAIN = "@pc.es.gov.br";
export const DEFAULT_LOTACAO = "Central de Teleflagrante";

export const isValidInstitutionalEmail = (email: string): boolean =>
  email.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN);

// Mapeia texto livre (delegacia/unidade) para uma das REGIONALS oficiais.
export function matchRegionalByKeyword(input: string | undefined): string {
  if (!input) return "";
  const norm = input.toUpperCase();
  for (const r of REGIONALS) {
    const key = r.split(" - ")[1] ?? r;
    if (norm.includes(key.toUpperCase())) return r;
  }
  if (norm.includes("DEACLE")) return "DEACLE";
  return "";
}
