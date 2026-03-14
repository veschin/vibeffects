import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { groupWordsIntoPhrases, getActivePhrase, getActiveWord } from "../subtitles";
import type { TranscriptionWord } from "../types";

const seedDir = join(__dirname, "../../../.ptsd/seeds/subtitles");

function loadTranscription(): { words: TranscriptionWord[]; durationMs: number } {
  return JSON.parse(
    readFileSync(join(seedDir, "transcription-excerpt.json"), "utf-8"),
  );
}

describe("groupWordsIntoPhrases", () => {
  it("separates words with >200ms gap into different phrases", () => {
    // "Так" ends at 260ms, "попробуем" starts at 550ms → gap 290ms > 200ms
    const { words } = loadTranscription();
    const phrases = groupWordsIntoPhrases(words);
    const firstPhrase = phrases[0];
    const secondPhrase = phrases[1];

    expect(firstPhrase.words.map((w) => w.text)).toContain("Так");
    expect(secondPhrase.words.map((w) => w.text)).toContain("попробуем");
    // They should NOT be in the same phrase
    expect(firstPhrase.words.map((w) => w.text)).not.toContain("попробуем");
  });

  it("groups words with <=200ms gap into same phrase", () => {
    // "в" ends at 910ms, "формате" starts at 950ms → gap 40ms ≤ 200ms
    const { words } = loadTranscription();
    const phrases = groupWordsIntoPhrases(words);
    const phrase = phrases.find((p) =>
      p.words.some((w) => w.text === "в") &&
      p.words.some((w) => w.text === "формате"),
    );
    expect(phrase).toBeDefined();
  });

  it("returns empty array for empty words", () => {
    expect(groupWordsIntoPhrases([])).toHaveLength(0);
  });
});

describe("getActivePhrase", () => {
  it("returns phrase containing the given time", () => {
    const { words } = loadTranscription();
    const phrases = groupWordsIntoPhrases(words);
    // At 1100ms, "формате" spans 950-1370ms
    const active = getActivePhrase(phrases, 1100);
    expect(active).not.toBeNull();
    expect(active!.words.some((w) => w.text === "формате")).toBe(true);
  });

  it("returns null for time between phrases", () => {
    const { words } = loadTranscription();
    const phrases = groupWordsIntoPhrases(words);
    // Gap between "Так" (ends 260) and "попробуем" (starts 550)
    const active = getActivePhrase(phrases, 400);
    expect(active).toBeNull();
  });
});

describe("getActiveWord", () => {
  it("returns the word active at given time", () => {
    const { words } = loadTranscription();
    const phrases = groupWordsIntoPhrases(words);
    const phrase = getActivePhrase(phrases, 1100)!;
    const word = getActiveWord(phrase, 1100);
    expect(word).not.toBeNull();
    expect(word!.text).toBe("формате");
  });
});
