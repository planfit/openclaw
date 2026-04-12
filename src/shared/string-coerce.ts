export function normalizeLowercaseStringOrEmpty(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase();
}

export function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeOptionalLowercaseString(value: unknown): string | undefined {
  const result = normalizeOptionalString(value);
  return result?.toLowerCase();
}
