import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  VideoSpecSchema,
  SceneSpecSchema,
  CommentaryEntrySchema,
  ElementSchema,
  validateSpec,
} from "../schema";

const seedDir = join(__dirname, "../../../.ptsd/seeds");

function loadSeed(feature: string, file: string) {
  return JSON.parse(readFileSync(join(seedDir, feature, file), "utf-8"));
}

describe("VideoSpecSchema", () => {
  it("validates spec-happy.json with version 2", () => {
    const spec = loadSeed("engine-core", "spec-happy.json");
    const result = VideoSpecSchema.safeParse(spec);
    expect(result.success).toBe(true);
  });

  it("rejects spec with version 1", () => {
    const spec = loadSeed("engine-core", "spec-happy.json");
    spec.version = 1;
    const result = VideoSpecSchema.safeParse(spec);
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join(", ");
      expect(msg).toContain("unsupported spec version");
    }
  });

  it("rejects spec without version field", () => {
    const spec = loadSeed("engine-core", "spec-happy.json");
    delete (spec as Record<string, unknown>).version;
    const result = VideoSpecSchema.safeParse(spec);
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join(", ");
      expect(msg).toContain("unsupported spec version");
    }
  });

  it("accepts spec with empty scenes", () => {
    const spec = loadSeed("engine-core", "spec-empty-scenes.json");
    const result = VideoSpecSchema.safeParse(spec);
    expect(result.success).toBe(true);
  });
});

describe("SceneSpecSchema", () => {
  it("rejects scene with endSec <= startSec", () => {
    const scene = loadSeed("engine-core", "spec-invalid.json").scenes[0];
    const result = SceneSpecSchema.safeParse(scene);
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join(", ");
      expect(msg).toContain("endSec must be greater than startSec");
    }
  });

  it("accepts valid scene from spec-happy.json", () => {
    const scene = loadSeed("engine-core", "spec-happy.json").scenes[0];
    const result = SceneSpecSchema.safeParse(scene);
    expect(result.success).toBe(true);
  });
});

describe("CommentaryEntrySchema", () => {
  it("accepts valid commentary entries", () => {
    const data = loadSeed("ai-commentary", "commentary-happy.json");
    for (const entry of data.commentary) {
      const result = CommentaryEntrySchema.safeParse(entry);
      expect(result.success).toBe(true);
    }
  });

  it("rejects text exceeding 140 chars", () => {
    const data = loadSeed("ai-commentary", "commentary-toolong.json");
    const entry = data.commentary[0];
    const result = CommentaryEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("text");
    }
  });
});

describe("ElementSchema", () => {
  it("validates a text element", () => {
    const el = {
      id: "t1",
      type: "text",
      text: "hello",
      enterSec: 0,
    };
    expect(ElementSchema.safeParse(el).success).toBe(true);
  });

  it("validates all 14 element types", () => {
    const elements = [
      { id: "1", type: "text", text: "a", enterSec: 0 },
      { id: "2", type: "heading", text: "b", enterSec: 0 },
      { id: "3", type: "code", code: "x", language: "ts", enterSec: 0 },
      { id: "4", type: "image", src: "a.png", enterSec: 0 },
      { id: "5", type: "bulletList", items: ["a"], enterSec: 0 },
      { id: "6", type: "table", headers: ["h"], rows: [["r"]], enterSec: 0 },
      { id: "7", type: "graph", nodes: [{ id: "n", label: "N" }], edges: [], enterSec: 0 },
      { id: "8", type: "chart", chartType: "bar", data: {}, enterSec: 0 },
      { id: "9", type: "icon", name: "star", enterSec: 0 },
      { id: "10", type: "divider", enterSec: 0 },
      { id: "11", type: "badge", text: "NEW", enterSec: 0 },
      { id: "12", type: "progress", value: 50, enterSec: 0 },
      { id: "13", type: "counter", value: 42, enterSec: 0 },
      { id: "14", type: "callout", text: "note", enterSec: 0 },
    ];
    for (const el of elements) {
      const result = ElementSchema.safeParse(el);
      expect(result.success, `Failed for type: ${el.type}`).toBe(true);
    }
  });

  it("rejects unknown element type", () => {
    const el = { id: "x", type: "unknown", enterSec: 0 };
    expect(ElementSchema.safeParse(el).success).toBe(false);
  });
});

describe("validateSpec", () => {
  it("detects duplicate element IDs across scenes", () => {
    const spec = {
      version: 2,
      meta: { title: "Test" },
      audio: "a.mp3",
      transcription: "t.json",
      theme: {},
      scenes: [
        {
          id: "s1", title: "S1", startSec: 0, endSec: 10, accent: "#fff",
          content: [{ id: "dup", type: "text", text: "a", enterSec: 0 }],
        },
        {
          id: "s2", title: "S2", startSec: 10, endSec: 20, accent: "#000",
          content: [{ id: "dup", type: "text", text: "b", enterSec: 0 }],
        },
      ],
    };
    const result = validateSpec(spec);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes("duplicate element ID"))).toBe(true);
  });
});
