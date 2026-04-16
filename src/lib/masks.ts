// Lightweight input masks (no extra deps).
// Use as: onChange={(e) => setX(maskPhone(e.target.value))}

/** Brazilian phone mask: (##) #####-#### or (##) ####-####. */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** NF mask: digits only, no length limit. */
export function maskNF(value: string): string {
  return value.replace(/\D/g, "");
}

/** Returns only digits — useful for stripping a masked value before persisting. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}
