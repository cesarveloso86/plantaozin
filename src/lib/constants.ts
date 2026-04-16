// App-wide constants
export const ALLOWED_EMAIL_DOMAIN = "@pc.es.gov.br";
export const DEFAULT_LOTACAO = "Central de Teleflagrante";

export const isValidInstitutionalEmail = (email: string): boolean =>
  email.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN);
