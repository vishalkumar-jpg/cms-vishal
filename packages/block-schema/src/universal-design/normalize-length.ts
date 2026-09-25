import type { NormalizedLength } from "./types";

const LENGTH_UNIT_PATTERN = /^(-?\d+(?:\.\d+)?)(px|%|rem|em|vw|vh)$/i;

export const normalizeLengthValue = (raw: unknown): NormalizedLength | undefined => {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return { value: raw, unit: "px" };
  }
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const match = trimmed.match(LENGTH_UNIT_PATTERN);
  if (match) {
    return {
      value: Number(match[1]),
      unit: match[2].toLowerCase() as NormalizedLength["unit"],
    };
  }
  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber)) {
    return { value: asNumber, unit: "px" };
  }
  return undefined;
};
