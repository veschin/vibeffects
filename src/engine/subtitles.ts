import type { TranscriptionWord } from "./types";

export interface Phrase {
  words: TranscriptionWord[];
  startMs: number;
  endMs: number;
}

const PAUSE_THRESHOLD_MS = 200;

/**
 * Group transcription words into phrases.
 * Words separated by more than 200ms gap are placed in separate phrases.
 */
export function groupWordsIntoPhrases(words: TranscriptionWord[]): Phrase[] {
  if (words.length === 0) return [];

  const phrases: Phrase[] = [];
  let current: TranscriptionWord[] = [words[0]];

  for (let i = 1; i < words.length; i++) {
    const gap = words[i].startMs - words[i - 1].endMs;
    if (gap > PAUSE_THRESHOLD_MS) {
      phrases.push({
        words: current,
        startMs: current[0].startMs,
        endMs: current[current.length - 1].endMs,
      });
      current = [words[i]];
    } else {
      current.push(words[i]);
    }
  }

  phrases.push({
    words: current,
    startMs: current[0].startMs,
    endMs: current[current.length - 1].endMs,
  });

  return phrases;
}

/**
 * Find the active phrase at a given time in milliseconds.
 */
export function getActivePhrase(
  phrases: Phrase[],
  timeMs: number,
): Phrase | null {
  return phrases.find((p) => timeMs >= p.startMs && timeMs <= p.endMs) ?? null;
}

/**
 * Find the active word within a phrase at a given time.
 */
export function getActiveWord(
  phrase: Phrase,
  timeMs: number,
): TranscriptionWord | null {
  return phrase.words.find((w) => timeMs >= w.startMs && timeMs <= w.endMs) ?? null;
}
