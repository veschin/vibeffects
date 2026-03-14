import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { resolveCommentaryTimings } from "../commentary";
import type { CommentaryEntry } from "../types";

const seedDir = join(__dirname, "../../../.ptsd/seeds/ai-commentary");

function loadSeed(file: string) {
  return JSON.parse(readFileSync(join(seedDir, file), "utf-8"));
}

describe("resolveCommentaryTimings", () => {
  it("preserves non-overlapping entry timings", () => {
    const data = loadSeed("commentary-happy.json");
    const resolved = resolveCommentaryTimings(data.commentary);
    expect(resolved).toHaveLength(3);
    // Non-overlapping entries keep their original startSec
    expect(resolved[0].effectiveStartSec).toBe(15.5);
    expect(resolved[1].effectiveStartSec).toBe(45.0);
    expect(resolved[2].effectiveStartSec).toBe(120.0);
  });

  it("shifts overlapping entries with 0.5s gap", () => {
    const data = loadSeed("commentary-overlap.json");
    const resolved = resolveCommentaryTimings(data.commentary);
    // entry1: startSec=10.0, durationSec=5 → ends at 15.0
    // entry2: original startSec=12.0, but must wait → effective = 15.0 + 0.5 = 15.5
    expect(resolved[0].effectiveStartSec).toBe(10.0);
    expect(resolved[1].effectiveStartSec).toBe(15.5);
  });

  it("does not modify original startSec values", () => {
    const data = loadSeed("commentary-overlap.json");
    const resolved = resolveCommentaryTimings(data.commentary);
    expect(resolved[1].startSec).toBe(12.0);
    expect(resolved[1].effectiveStartSec).toBe(15.5);
  });

  it("returns empty array for empty input", () => {
    const resolved = resolveCommentaryTimings([]);
    expect(resolved).toHaveLength(0);
  });
});
