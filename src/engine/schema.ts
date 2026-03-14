import { z } from "zod";

// Position & Animation
export const PositionSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  anchor: z
    .enum(["center", "top-left", "top-right", "bottom-left", "bottom-right"])
    .optional(),
});

export const AnimationConfigSchema = z.object({
  entrance: z
    .enum(["spring", "fade", "slide", "scale", "none"])
    .optional(),
  exit: z.enum(["fade", "slide", "none"]).optional(),
  delay: z.number().optional(),
});

// Base element fields
const baseFields = {
  id: z.string(),
  enterSec: z.number(),
  exitSec: z.number().optional(),
  position: PositionSchema.optional(),
  animation: AnimationConfigSchema.optional(),
};

// 14 Element schemas
export const TextElementSchema = z.object({
  ...baseFields,
  type: z.literal("text"),
  text: z.string(),
  fontSize: z.number().optional(),
});

export const HeadingElementSchema = z.object({
  ...baseFields,
  type: z.literal("heading"),
  text: z.string(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
});

export const CodeElementSchema = z.object({
  ...baseFields,
  type: z.literal("code"),
  code: z.string(),
  language: z.string(),
  highlights: z.array(z.array(z.number())).optional(),
});

export const ImageElementSchema = z.object({
  ...baseFields,
  type: z.literal("image"),
  src: z.string(),
  fit: z.enum(["contain", "cover"]).optional(),
  caption: z.string().optional(),
});

export const BulletListElementSchema = z.object({
  ...baseFields,
  type: z.literal("bulletList"),
  title: z.string().optional(),
  items: z.array(z.string()),
});

export const TableElementSchema = z.object({
  ...baseFields,
  type: z.literal("table"),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  highlightRows: z.array(z.number()).optional(),
});

export const GraphNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  group: z.string().optional(),
});

export const GraphEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
});

export const GraphElementSchema = z.object({
  ...baseFields,
  type: z.literal("graph"),
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
  layout: z.enum(["layered", "radial"]).optional(),
});

export const ChartElementSchema = z.object({
  ...baseFields,
  type: z.literal("chart"),
  chartType: z.enum(["bar", "pie", "line"]),
  data: z.unknown(),
  title: z.string().optional(),
});

export const IconElementSchema = z.object({
  ...baseFields,
  type: z.literal("icon"),
  name: z.string(),
  size: z.number().optional(),
});

export const DividerElementSchema = z.object({
  ...baseFields,
  type: z.literal("divider"),
  direction: z.enum(["horizontal", "vertical"]).optional(),
});

export const BadgeElementSchema = z.object({
  ...baseFields,
  type: z.literal("badge"),
  text: z.string(),
  color: z.string().optional(),
});

export const ProgressElementSchema = z.object({
  ...baseFields,
  type: z.literal("progress"),
  value: z.number(),
  max: z.number().optional(),
  label: z.string().optional(),
});

export const CounterElementSchema = z.object({
  ...baseFields,
  type: z.literal("counter"),
  value: z.number(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  label: z.string().optional(),
});

export const CalloutElementSchema = z.object({
  ...baseFields,
  type: z.literal("callout"),
  text: z.string(),
  calloutType: z
    .enum(["warning", "tip", "note", "important", "quote"])
    .optional(),
  title: z.string().optional(),
});

// Discriminated union of all 14 element types
export const ElementSchema = z.discriminatedUnion("type", [
  TextElementSchema,
  HeadingElementSchema,
  CodeElementSchema,
  ImageElementSchema,
  BulletListElementSchema,
  TableElementSchema,
  GraphElementSchema,
  ChartElementSchema,
  IconElementSchema,
  DividerElementSchema,
  BadgeElementSchema,
  ProgressElementSchema,
  CounterElementSchema,
  CalloutElementSchema,
]);

// Pattern instance
export const PatternInstanceSchema = z.object({
  pattern: z.string(),
  params: z.record(z.unknown()),
  enterSec: z.number().optional(),
  durationSec: z.number().optional(),
});

// Content item: either pattern or raw element
export const ContentItemSchema = z.union([
  PatternInstanceSchema,
  ElementSchema,
]);

// Background config
export const BackgroundConfigSchema = z.object({
  type: z.enum(["shapes", "gradient", "grid", "none"]),
  intensity: z.number().optional(),
});

// Scene spec with refinement
export const SceneSpecSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    startSec: z.number(),
    endSec: z.number(),
    accent: z.string(),
    background: BackgroundConfigSchema.optional(),
    content: z.array(ContentItemSchema),
  })
  .refine((s) => s.endSec > s.startSec, {
    message: "endSec must be greater than startSec",
  });

// Commentary entry
export const CommentaryEntrySchema = z.object({
  startSec: z.number(),
  durationSec: z.number().optional(),
  text: z.string().max(140),
  type: z.enum(["correction", "note", "joke"]),
});

// Subtitle config
export const SubtitleConfigSchema = z.object({
  enabled: z.boolean().optional(),
  fontSize: z.number().optional(),
  position: z.enum(["bottom", "top"]).optional(),
  style: z.enum(["pill", "plain", "outline", "highlight"]).optional(),
});

// Meta config
export const MetaConfigSchema = z.object({
  title: z.string(),
  fps: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

// Theme config
export const ThemeConfigSchema = z.object({
  palette: z.string().optional(),
  overrides: z.record(z.unknown()).optional(),
  fonts: z
    .object({
      display: z.string().optional(),
      body: z.string().optional(),
      code: z.string().optional(),
    })
    .optional(),
  animation: z
    .object({
      entrance: z.enum(["spring", "fade", "slide", "scale"]).optional(),
      speed: z.enum(["slow", "normal", "fast"]).optional(),
    })
    .optional(),
  background: BackgroundConfigSchema.optional(),
});

// VideoSpec v2
export const VideoSpecSchema = z
  .object({
    version: z.literal(2, {
      errorMap: () => ({ message: "unsupported spec version" }),
    }),
    meta: MetaConfigSchema,
    audio: z.string(),
    transcription: z.string(),
    theme: ThemeConfigSchema,
    scenes: z.array(SceneSpecSchema),
    subtitles: z.union([SubtitleConfigSchema, z.literal(false)]).optional(),
    commentary: z.array(CommentaryEntrySchema).optional(),
  });

// Validate spec and check for duplicate element IDs
export function validateSpec(data: unknown): {
  success: boolean;
  data?: z.infer<typeof VideoSpecSchema>;
  errors?: string[];
} {
  const result = VideoSpecSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }

  // Check duplicate element IDs
  const ids = new Set<string>();
  const duplicates: string[] = [];

  for (const scene of result.data.scenes) {
    for (const item of scene.content) {
      if ("id" in item && typeof item.id === "string") {
        if (ids.has(item.id)) {
          duplicates.push(item.id);
        }
        ids.add(item.id);
      }
    }
  }

  if (duplicates.length > 0) {
    return {
      success: false,
      errors: duplicates.map((id) => `duplicate element ID: "${id}"`),
    };
  }

  return { success: true, data: result.data };
}
