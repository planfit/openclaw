import { lookup as dnsLookupCb, type LookupAddress } from "node:dns";
import { lookup as dnsLookup } from "node:dns/promises";
import { Agent, type Dispatcher } from "undici";

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

export class SsrFBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrFBlockedError";
  }
}

export type LookupFn = typeof dnsLookup;

export type SsrFPolicy = {
  allowPrivateNetwork?: boolean;
  allowedHostnames?: string[];
};

const PRIVATE_IPV6_PREFIXES = ["fe80:", "fec0:", "fc", "fd"];
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
]);

function normalizeHostname(hostname: string): string {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    return normalized.slice(1, -1);
  }
  return normalized;
}

function normalizeHostnameSet(values?: string[]): Set<string> {
  if (!values || values.length === 0) {
    return new Set<string>();
  }
  return new Set(values.map((value) => normalizeHostname(value)).filter(Boolean));
}

function parseIpv4(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) {
    return null;
  }
  const numbers = parts.map((part) => Number.parseInt(part, 10));
  if (numbers.some((value) => Number.isNaN(value) || value < 0 || value > 255)) {
    return null;
  }
  return numbers;
}

function parseIpv4FromMappedIpv6(mapped: string): number[] | null {
  if (mapped.includes(".")) {
    return parseIpv4(mapped);
  }
  const parts = mapped.split(":").filter(Boolean);
  if (parts.length === 1) {
    const value = Number.parseInt(parts[0], 16);
    if (Number.isNaN(value) || value < 0 || value > 0xffff_ffff) {
      return null;
    }
    return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
  }
  if (parts.length !== 2) {
    return null;
  }
  const high = Number.parseInt(parts[0], 16);
  const low = Number.parseInt(parts[1], 16);
  if (
    Number.isNaN(high) ||
    Number.isNaN(low) ||
    high < 0 ||
    low < 0 ||
    high > 0xffff ||
    low > 0xffff
  ) {
    return null;
  }
  const value = (high << 16) + low;
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function parseIpv6Hextets(input: string): number[] | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed || !trimmed.includes(":")) {
    return null;
  }

  // Handle dotted-quad suffix (e.g., ::ffff:192.168.0.1)
  const lastColonIndex = trimmed.lastIndexOf(":");
  const possibleIpv4 = trimmed.slice(lastColonIndex + 1);
  if (possibleIpv4.includes(".")) {
    const ipv4Parts = parseIpv4(possibleIpv4);
    if (!ipv4Parts) {
      return null;
    }
    const prefix = trimmed.slice(0, lastColonIndex);
    const high = (ipv4Parts[0] << 8) | ipv4Parts[1];
    const low = (ipv4Parts[2] << 8) | ipv4Parts[3];
    const prefixHextets = parseIpv6Hextets(`${prefix}:${high.toString(16)}:${low.toString(16)}`);
    return prefixHextets;
  }

  const doubleColonParts = trimmed.split("::");
  if (doubleColonParts.length > 2) {
    return null;
  }

  const headParts = doubleColonParts[0] ? doubleColonParts[0].split(":") : [];
  const tailParts =
    doubleColonParts.length === 2 && doubleColonParts[1]
      ? doubleColonParts[1].split(":")
      : doubleColonParts.length === 2
        ? []
        : [];
  const missingParts = 8 - headParts.length - tailParts.length;

  const fullParts =
    doubleColonParts.length === 1
      ? trimmed.split(":")
      : [...headParts, ...Array.from({ length: missingParts }, () => "0"), ...tailParts];

  if (fullParts.length !== 8) {
    return null;
  }

  const hextets: number[] = [];
  for (const part of fullParts) {
    if (!part) {
      return null;
    }
    const hexValue = Number.parseInt(part, 16);
    if (Number.isNaN(hexValue) || hexValue < 0 || hexValue > 0xffff) {
      return null;
    }
    hextets.push(hexValue);
  }
  return hextets;
}

function decodeIpv4FromHextets(high: number, low: number): number[] {
  return [(high >>> 8) & 0xff, high & 0xff, (low >>> 8) & 0xff, low & 0xff];
}

type EmbeddedIpv4Rule = {
  matches: (hextets: number[]) => boolean;
  extract: (hextets: number[]) => [high: number, low: number];
};

const EMBEDDED_IPV4_RULES: EmbeddedIpv4Rule[] = [
  {
    // IPv4-mapped: ::ffff:a.b.c.d and IPv4-compatible ::a.b.c.d.
    matches: (hextets) =>
      hextets[0] === 0 &&
      hextets[1] === 0 &&
      hextets[2] === 0 &&
      hextets[3] === 0 &&
      hextets[4] === 0 &&
      (hextets[5] === 0xffff || hextets[5] === 0),
    extract: (hextets) => [hextets[6], hextets[7]],
  },
  {
    // NAT64 well-known prefix: 64:ff9b::/96.
    matches: (hextets) =>
      hextets[0] === 0x0064 &&
      hextets[1] === 0xff9b &&
      hextets[2] === 0 &&
      hextets[3] === 0 &&
      hextets[4] === 0 &&
      hextets[5] === 0,
    extract: (hextets) => [hextets[6], hextets[7]],
  },
  {
    // NAT64 local-use prefix: 64:ff9b:1::/48.
    matches: (hextets) =>
      hextets[0] === 0x0064 &&
      hextets[1] === 0xff9b &&
      hextets[2] === 0x0001 &&
      hextets[3] === 0 &&
      hextets[4] === 0 &&
      hextets[5] === 0,
    extract: (hextets) => [hextets[6], hextets[7]],
  },
  {
    // 6to4 prefix: 2002::/16 where hextets[1..2] carry IPv4.
    matches: (hextets) => hextets[0] === 0x2002,
    extract: (hextets) => [hextets[1], hextets[2]],
  },
  {
    // Teredo prefix: 2001:0000::/32 with client IPv4 obfuscated via XOR 0xffff.
    matches: (hextets) => hextets[0] === 0x2001 && hextets[1] === 0x0000,
    extract: (hextets) => [hextets[6] ^ 0xffff, hextets[7] ^ 0xffff],
  },
  {
    // ISATAP IID format: 000000ug00000000:5efe:w.x.y.z (RFC 5214 section 6.1).
    // Match only the IID marker bits to avoid over-broad :5efe: detection.
    matches: (hextets) => (hextets[4] & 0xfcff) === 0 && hextets[5] === 0x5efe,
    extract: (hextets) => [hextets[6], hextets[7]],
  },
];

function extractIpv4FromEmbeddedIpv6(hextets: number[]): number[] | null {
  for (const rule of EMBEDDED_IPV4_RULES) {
    if (rule.matches(hextets)) {
      const [high, low] = rule.extract(hextets);
      return decodeIpv4FromHextets(high, low);
    }
  }
  return null;
}

function isPrivateIpv4(parts: number[]): boolean {
  const [octet1, octet2] = parts;
  if (octet1 === 0) {
    return true;
  }
  if (octet1 === 10) {
    return true;
  }
  if (octet1 === 127) {
    return true;
  }
  if (octet1 === 169 && octet2 === 254) {
    return true;
  }
  if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) {
    return true;
  }
  if (octet1 === 192 && octet2 === 168) {
    return true;
  }
  if (octet1 === 100 && octet2 >= 64 && octet2 <= 127) {
    return true;
  }
  return false;
}

export function isPrivateIpAddress(address: string): boolean {
  let normalized = address.trim().toLowerCase();
  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    normalized = normalized.slice(1, -1);
  }
  if (!normalized) {
    return false;
  }

  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    const ipv4 = parseIpv4FromMappedIpv6(mapped);
    if (ipv4) {
      return isPrivateIpv4(ipv4);
    }
  }

  if (normalized.includes(":")) {
    const hextets = parseIpv6Hextets(normalized);
    if (!hextets) {
      // Security-critical parse failures should fail closed.
      return true;
    }

    // Check embedded IPv4 in IPv6 transition mechanisms (NAT64, 6to4, Teredo, etc.)
    const embeddedIpv4 = extractIpv4FromEmbeddedIpv6(hextets);
    if (embeddedIpv4 && isPrivateIpv4(embeddedIpv4)) {
      return true;
    }

    const isUnspecified =
      hextets[0] === 0 &&
      hextets[1] === 0 &&
      hextets[2] === 0 &&
      hextets[3] === 0 &&
      hextets[4] === 0 &&
      hextets[5] === 0 &&
      hextets[6] === 0 &&
      hextets[7] === 0;
    const isLoopback =
      hextets[0] === 0 &&
      hextets[1] === 0 &&
      hextets[2] === 0 &&
      hextets[3] === 0 &&
      hextets[4] === 0 &&
      hextets[5] === 0 &&
      hextets[6] === 0 &&
      hextets[7] === 1;
    if (isUnspecified || isLoopback) {
      return true;
    }
    return PRIVATE_IPV6_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  }

  const ipv4 = parseIpv4(normalized);
  if (!ipv4) {
    return false;
  }
  return isPrivateIpv4(ipv4);
}

export function isBlockedHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (!normalized) {
    return false;
  }
  if (BLOCKED_HOSTNAMES.has(normalized)) {
    return true;
  }
  return (
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  );
}

export function isBlockedHostnameOrIp(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (!normalized) {
    return false;
  }
  return isBlockedHostname(normalized) || isPrivateIpAddress(normalized);
}

export function createPinnedLookup(params: {
  hostname: string;
  addresses: string[];
  fallback?: typeof dnsLookupCb;
}): typeof dnsLookupCb {
  const normalizedHost = normalizeHostname(params.hostname);
  const fallback = params.fallback ?? dnsLookupCb;
  const fallbackLookup = fallback as unknown as (
    hostname: string,
    callback: LookupCallback,
  ) => void;
  const fallbackWithOptions = fallback as unknown as (
    hostname: string,
    options: unknown,
    callback: LookupCallback,
  ) => void;
  const records = params.addresses.map((address) => ({
    address,
    family: address.includes(":") ? 6 : 4,
  }));
  let index = 0;

  return ((host: string, options?: unknown, callback?: unknown) => {
    const cb: LookupCallback =
      typeof options === "function" ? (options as LookupCallback) : (callback as LookupCallback);
    if (!cb) {
      return;
    }
    const normalized = normalizeHostname(host);
    if (!normalized || normalized !== normalizedHost) {
      if (typeof options === "function" || options === undefined) {
        return fallbackLookup(host, cb);
      }
      return fallbackWithOptions(host, options, cb);
    }

    const opts =
      typeof options === "object" && options !== null
        ? (options as { all?: boolean; family?: number })
        : {};
    const requestedFamily =
      typeof options === "number" ? options : typeof opts.family === "number" ? opts.family : 0;
    const candidates =
      requestedFamily === 4 || requestedFamily === 6
        ? records.filter((entry) => entry.family === requestedFamily)
        : records;
    const usable = candidates.length > 0 ? candidates : records;
    if (opts.all) {
      cb(null, usable as LookupAddress[]);
      return;
    }
    const chosen = usable[index % usable.length];
    index += 1;
    cb(null, chosen.address, chosen.family);
  }) as typeof dnsLookupCb;
}

export type PinnedHostname = {
  hostname: string;
  addresses: string[];
  lookup: typeof dnsLookupCb;
};

export async function resolvePinnedHostnameWithPolicy(
  hostname: string,
  params: { lookupFn?: LookupFn; policy?: SsrFPolicy } = {},
): Promise<PinnedHostname> {
  const normalized = normalizeHostname(hostname);
  if (!normalized) {
    throw new Error("Invalid hostname");
  }

  const allowPrivateNetwork = Boolean(params.policy?.allowPrivateNetwork);
  const allowedHostnames = normalizeHostnameSet(params.policy?.allowedHostnames);
  const isExplicitAllowed = allowedHostnames.has(normalized);

  if (!allowPrivateNetwork && !isExplicitAllowed) {
    if (isBlockedHostname(normalized)) {
      throw new SsrFBlockedError(`Blocked hostname: ${hostname}`);
    }

    if (isPrivateIpAddress(normalized)) {
      throw new SsrFBlockedError("Blocked: private/internal IP address");
    }
  }

  const lookupFn = params.lookupFn ?? dnsLookup;
  const results = await lookupFn(normalized, { all: true });
  if (results.length === 0) {
    throw new Error(`Unable to resolve hostname: ${hostname}`);
  }

  if (!allowPrivateNetwork && !isExplicitAllowed) {
    for (const entry of results) {
      if (isPrivateIpAddress(entry.address)) {
        throw new SsrFBlockedError("Blocked: resolves to private/internal IP address");
      }
    }
  }

  const addresses = Array.from(new Set(results.map((entry) => entry.address)));
  if (addresses.length === 0) {
    throw new Error(`Unable to resolve hostname: ${hostname}`);
  }

  return {
    hostname: normalized,
    addresses,
    lookup: createPinnedLookup({ hostname: normalized, addresses }),
  };
}

export async function resolvePinnedHostname(
  hostname: string,
  lookupFn: LookupFn = dnsLookup,
): Promise<PinnedHostname> {
  return await resolvePinnedHostnameWithPolicy(hostname, { lookupFn });
}

export function createPinnedDispatcher(pinned: PinnedHostname): Dispatcher {
  return new Agent({
    connect: {
      lookup: pinned.lookup,
    },
  });
}

export async function closeDispatcher(dispatcher?: Dispatcher | null): Promise<void> {
  if (!dispatcher) {
    return;
  }
  const candidate = dispatcher as { close?: () => Promise<void> | void; destroy?: () => void };
  try {
    if (typeof candidate.close === "function") {
      await candidate.close();
      return;
    }
    if (typeof candidate.destroy === "function") {
      candidate.destroy();
    }
  } catch {
    // ignore dispatcher cleanup errors
  }
}

export async function assertPublicHostname(
  hostname: string,
  lookupFn: LookupFn = dnsLookup,
): Promise<void> {
  await resolvePinnedHostname(hostname, lookupFn);
}
