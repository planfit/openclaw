import { isPlainObject } from "../utils.js";
import { isBlockedObjectKey } from "./prototype-keys.js";

type PlainObject = Record<string, unknown>;

type MergePatchOptions = {
  mergeObjectArraysById?: boolean;
};

function isObjectWithStringId(value: unknown): value is Record<string, unknown> & { id: string } {
  if (!isPlainObject(value)) {
    return false;
  }
  return typeof value.id === "string" && value.id.length > 0;
}

/**
 * Merge arrays of object-like entries keyed by `id`.
 */
function _mergeObjectArraysById(
  base: unknown[],
  patch: unknown[],
  options: MergePatchOptions,
): unknown[] | undefined {
  if (!base.every(isObjectWithStringId)) {
    return undefined;
  }

  const merged: unknown[] = [...base];
  const indexById = new Map<string, number>();
  for (const [index, entry] of merged.entries()) {
    if (!isObjectWithStringId(entry)) {
      return undefined;
    }
    indexById.set(entry.id, index);
  }

  for (const patchEntry of patch) {
    if (!isObjectWithStringId(patchEntry)) {
      merged.push(structuredClone(patchEntry));
      continue;
    }

    const existingIndex = indexById.get(patchEntry.id);
    if (existingIndex === undefined) {
      merged.push(structuredClone(patchEntry));
      indexById.set(patchEntry.id, merged.length - 1);
      continue;
    }

    merged[existingIndex] = applyMergePatch(merged[existingIndex], patchEntry, options);
  }

  return merged;
}

export function applyMergePatch(
  base: unknown,
  patch: unknown,
  _options: MergePatchOptions = {},
): unknown {
  if (!isPlainObject(patch)) {
    return patch;
  }

  const result: PlainObject = isPlainObject(base) ? { ...base } : {};

  for (const [key, value] of Object.entries(patch)) {
    if (isBlockedObjectKey(key)) {
      continue;
    }
    if (value === null) {
      delete result[key];
      continue;
    }
    if (isPlainObject(value)) {
      const baseValue = result[key];
      result[key] = applyMergePatch(isPlainObject(baseValue) ? baseValue : {}, value);
      continue;
    }
    result[key] = value;
  }

  return result;
}
