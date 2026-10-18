export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeEquipmentCode(code: string): string {
  return code.trim().toUpperCase();
}
