import { describe, it, expect } from "vitest";
import { PRESETS, getPalette } from "../palette";
import type { Palette } from "../types";

const EXPECTED_PRESETS = [
  "dark-cosmos",
  "warm-ember",
  "deep-ocean",
  "nibelung",
  "rose-quartz",
  "acid-neon",
];

const PALETTE_KEYS: (keyof Palette)[] = [
  "bg", "surface", "surfaceElevated", "overlay",
  "text", "textSecondary", "textMuted",
  "border", "borderStrong", "glow",
  "shadow", "shadowDeep",
  "blurAmount", "radiusBlock", "radiusSmall",
  "deco3dPrimary", "deco3dSecondary",
];

describe("Palette PRESETS", () => {
  it("contains all 6 preset IDs", () => {
    const ids = Object.keys(PRESETS);
    for (const name of EXPECTED_PRESETS) {
      expect(ids).toContain(name);
    }
    expect(ids.length).toBe(6);
  });

  for (const name of EXPECTED_PRESETS) {
    it(`"${name}" has all required fields`, () => {
      const palette = PRESETS[name];
      for (const key of PALETTE_KEYS) {
        expect(palette).toHaveProperty(key);
        expect(palette[key]).toBeDefined();
      }
    });
  }
});

describe("getPalette", () => {
  it("returns the palette for a valid preset", () => {
    const p = getPalette("dark-cosmos");
    expect(p.bg).toBe("#0a0a1a");
  });

  it("throws for unknown preset", () => {
    expect(() => getPalette("nonexistent")).toThrow('Unknown palette preset: "nonexistent"');
  });
});
