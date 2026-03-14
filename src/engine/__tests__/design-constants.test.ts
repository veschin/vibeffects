import { describe, it, expect } from "vitest";
import { DESIGN } from "../design-constants";

describe("DESIGN constants", () => {
  it("has focus ratios at 78% width and 72% height", () => {
    expect(DESIGN.focusRatios.width).toBe(0.78);
    expect(DESIGN.focusRatios.height).toBe(0.72);
  });

  it("has all required layout fields", () => {
    expect(DESIGN.scenePadding).toBeGreaterThan(0);
    expect(DESIGN.elementGap).toBeGreaterThan(0);
    expect(DESIGN.headingHeight).toBeGreaterThan(0);
  });

  it("has subtitle and commentary sizing", () => {
    expect(DESIGN.subtitleFontSize).toBe(28);
    expect(DESIGN.commentaryFontSize).toBe(18);
    expect(DESIGN.subtitleBottom).toBeGreaterThan(0);
    expect(DESIGN.commentaryTop).toBeGreaterThan(0);
  });

  it("has spring transition at 0.85s", () => {
    expect(DESIGN.springTransitionSec).toBe(0.85);
  });

  it("has default viewport dimensions", () => {
    expect(DESIGN.defaultWidth).toBe(1920);
    expect(DESIGN.defaultHeight).toBe(1080);
  });

  it("exports all values as numbers", () => {
    // All top-level values should be numbers or objects with number values
    for (const [key, value] of Object.entries(DESIGN)) {
      if (typeof value === "object") {
        for (const v of Object.values(value as Record<string, number>)) {
          expect(typeof v).toBe("number");
        }
      } else {
        expect(typeof value, `${key} should be a number`).toBe("number");
      }
    }
  });
});
