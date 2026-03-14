import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  getTotalDurationFrames,
  getSceneDurationFrames,
  isElementVisible,
  frameToSec,
  secToFrame,
} from "../timing";
import type { SceneSpec } from "../types";

const seedDir = join(__dirname, "../../../.ptsd/seeds/engine-core");

function loadSeed(file: string) {
  return JSON.parse(readFileSync(join(seedDir, file), "utf-8"));
}

describe("getTotalDurationFrames", () => {
  it("computes from max scene endSec (spec-happy.json: 210s @ 30fps = 6300)", () => {
    const spec = loadSeed("spec-happy.json");
    const result = getTotalDurationFrames(spec.scenes, 30);
    expect(result).toBe(6300);
  });

  it("returns 1 frame for empty scenes array", () => {
    const spec = loadSeed("spec-empty-scenes.json");
    const result = getTotalDurationFrames(spec.scenes, 30);
    expect(result).toBe(1);
  });

  it("uses default fps (30) when not specified", () => {
    const scenes: SceneSpec[] = [
      { id: "s", title: "S", startSec: 0, endSec: 10, accent: "#fff", content: [] },
    ];
    expect(getTotalDurationFrames(scenes)).toBe(300);
  });
});

describe("getSceneDurationFrames", () => {
  it("computes single scene duration", () => {
    const scene: SceneSpec = {
      id: "s", title: "S", startSec: 45.2, endSec: 120.5, accent: "#fff", content: [],
    };
    expect(getSceneDurationFrames(scene, 30)).toBe(Math.ceil(75.3 * 30));
  });
});

describe("isElementVisible", () => {
  it("returns true when within enterSec/exitSec window", () => {
    // Scene starts at 45.2s, element enters at 6s relative, exits at 20s relative
    // At absolute 51.5s → local time = 6.3s → visible
    expect(isElementVisible({ enterSec: 6, exitSec: 20 }, 45.2, 51.5)).toBe(true);
  });

  it("returns false before enterSec", () => {
    // Scene starts at 45.2s, element enters at 6s relative
    // At absolute 45.5s → local time = 0.3s → hidden
    expect(isElementVisible({ enterSec: 6 }, 45.2, 45.5)).toBe(false);
  });

  it("returns false at or after exitSec", () => {
    expect(isElementVisible({ enterSec: 0, exitSec: 10 }, 0, 10)).toBe(false);
    expect(isElementVisible({ enterSec: 0, exitSec: 10 }, 0, 15)).toBe(false);
  });

  it("returns true when no exitSec and past enterSec", () => {
    expect(isElementVisible({ enterSec: 5 }, 0, 100)).toBe(true);
  });
});

describe("frameToSec / secToFrame", () => {
  it("converts frame to seconds", () => {
    expect(frameToSec(150, 30)).toBe(5);
  });

  it("converts seconds to frame", () => {
    expect(secToFrame(5, 30)).toBe(150);
  });

  it("round-trips correctly", () => {
    expect(secToFrame(frameToSec(42, 30), 30)).toBe(42);
  });
});
