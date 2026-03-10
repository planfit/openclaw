import { looksLikeHandleOrPhoneTarget, trimMessagingTarget } from "./shared.js";

// WhatsApp normalization functions
export function normalizeWhatsAppTarget(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  // Remove whatsapp: prefix if present
  const cleaned = trimmed.replace(/^whatsapp:/i, "");

  // Group JID format: xxxxxx@g.us
  if (cleaned.includes("@g.us") || cleaned.includes("@")) {
    return cleaned;
  }

  // Phone number format: should start with +
  if (cleaned.startsWith("+")) {
    return cleaned;
  }

  // Try adding + prefix for numbers
  if (/^\d+$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  return cleaned;
}

export function isWhatsAppGroupJid(jid: string): boolean {
  return jid.includes("@g.us");
}

export function normalizeWhatsAppMessagingTarget(raw: string): string | undefined {
  const trimmed = trimMessagingTarget(raw);
  if (!trimmed) {
    return undefined;
  }
  return normalizeWhatsAppTarget(trimmed) ?? undefined;
}

export function normalizeWhatsAppAllowFromEntries(allowFrom: Array<string | number>): string[] {
  return allowFrom
    .map((entry) => String(entry).trim())
    .filter((entry): entry is string => Boolean(entry))
    .map((entry) => (entry === "*" ? entry : normalizeWhatsAppTarget(entry)))
    .filter((entry): entry is string => Boolean(entry));
}

export function looksLikeWhatsAppTargetId(raw: string): boolean {
  return looksLikeHandleOrPhoneTarget({
    raw,
    prefixPattern: /^whatsapp:/i,
  });
}
