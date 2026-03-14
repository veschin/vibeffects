import type { CommentaryEntry } from "./types";
import { DEFAULTS } from "./types";

export interface ResolvedCommentaryEntry extends CommentaryEntry {
  effectiveStartSec: number;
}

/**
 * Resolve overlapping commentary entries by shifting later ones.
 * Original startSec values are preserved; effectiveStartSec is computed.
 * Gap between entries: 0.5s.
 */
export function resolveCommentaryTimings(
  entries: CommentaryEntry[],
): ResolvedCommentaryEntry[] {
  if (entries.length === 0) return [];

  const sorted = [...entries].sort((a, b) => a.startSec - b.startSec);
  const result: ResolvedCommentaryEntry[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const duration = entry.durationSec ?? DEFAULTS.commentaryDurationSec;

    if (i === 0) {
      result.push({ ...entry, effectiveStartSec: entry.startSec });
    } else {
      const prev = result[i - 1];
      const prevEnd =
        prev.effectiveStartSec +
        (prev.durationSec ?? DEFAULTS.commentaryDurationSec);
      const minStart = prevEnd + 0.5;
      const effectiveStartSec = Math.max(entry.startSec, minStart);
      result.push({ ...entry, effectiveStartSec });
    }
  }

  return result;
}
