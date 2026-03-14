// VideoSpec v2 core types

export interface VideoSpec {
  version: 2;
  meta: MetaConfig;
  audio: string;
  transcription: string;
  theme: ThemeConfig;
  scenes: SceneSpec[];
  subtitles?: SubtitleConfig | false;
  commentary?: CommentaryEntry[];
}

export interface MetaConfig {
  title: string;
  fps?: number;
  width?: number;
  height?: number;
}

export interface ThemeConfig {
  palette?: string;
  overrides?: Partial<Palette>;
  fonts?: { display?: string; body?: string; code?: string };
  animation?: {
    entrance?: "spring" | "fade" | "slide" | "scale";
    speed?: "slow" | "normal" | "fast";
  };
  background?: {
    type: "shapes" | "gradient" | "grid" | "none";
    intensity?: number;
  };
}

export interface SubtitleConfig {
  enabled?: boolean;
  fontSize?: number;
  position?: "bottom" | "top";
  style?: "pill" | "plain" | "outline";
}

export interface CommentaryEntry {
  startSec: number;
  durationSec?: number;
  text: string;
  type: "correction" | "note" | "joke";
}

export interface SceneSpec {
  id: string;
  title: string;
  startSec: number;
  endSec: number;
  accent: string;
  background?: BackgroundConfig;
  content: ContentItem[];
}

export interface BackgroundConfig {
  type: "shapes" | "gradient" | "grid" | "none";
  intensity?: number;
}

export type ContentItem = PatternInstance | RawElement;

export interface PatternInstance {
  pattern: string;
  params: Record<string, unknown>;
  enterSec?: number;
  durationSec?: number;
}

export interface BaseElement {
  id: string;
  type: string;
  enterSec: number;
  exitSec?: number;
  position?: Position;
  animation?: AnimationConfig;
}

export interface Position {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  anchor?: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
}

export interface AnimationConfig {
  entrance?: "spring" | "fade" | "slide" | "scale" | "none";
  exit?: "fade" | "slide" | "none";
  delay?: number;
}

// Element types (discriminated union)
export interface TextElement extends BaseElement { type: "text"; text: string; fontSize?: number; }
export interface HeadingElement extends BaseElement { type: "heading"; text: string; level?: 1 | 2 | 3; }
export interface CodeElement extends BaseElement { type: "code"; code: string; language: string; highlights?: number[][]; }
export interface ImageElement extends BaseElement { type: "image"; src: string; fit?: "contain" | "cover"; caption?: string; }
export interface BulletListElement extends BaseElement { type: "bulletList"; title?: string; items: string[]; }
export interface TableElement extends BaseElement { type: "table"; headers: string[]; rows: string[][]; highlightRows?: number[]; }
export interface GraphElement extends BaseElement { type: "graph"; nodes: GraphNode[]; edges: GraphEdge[]; layout?: "layered" | "radial"; }
export interface ChartElement extends BaseElement { type: "chart"; chartType: "bar" | "pie" | "line"; data: unknown; title?: string; }
export interface IconElement extends BaseElement { type: "icon"; name: string; size?: number; }
export interface DividerElement extends BaseElement { type: "divider"; direction?: "horizontal" | "vertical"; }
export interface BadgeElement extends BaseElement { type: "badge"; text: string; color?: string; }
export interface ProgressElement extends BaseElement { type: "progress"; value: number; max?: number; label?: string; }
export interface CounterElement extends BaseElement { type: "counter"; value: number; prefix?: string; suffix?: string; label?: string; }
export interface CalloutElement extends BaseElement { type: "callout"; text: string; calloutType?: "warning" | "tip" | "note" | "important" | "quote"; title?: string; }

export type Element =
  | TextElement | HeadingElement | CodeElement | ImageElement
  | BulletListElement | TableElement | GraphElement | ChartElement
  | IconElement | DividerElement | BadgeElement | ProgressElement
  | CounterElement | CalloutElement;

export type RawElement = Element;

// Graph sub-types
export interface GraphNode { id: string; label: string; group?: string; }
export interface GraphEdge { from: string; to: string; label?: string; }

// Transcription types
export interface TranscriptionWord { text: string; startMs: number; endMs: number; confidence: number; }
export interface Transcription { words: TranscriptionWord[]; durationMs: number; }
export interface TranscriptionSegment { startSec: number; endSec: number; topic: string; keyPhrases: string[]; }

// Pattern system
export interface PatternDefinition {
  id: string;
  schema: unknown; // ZodSchema at runtime
  resolve: (params: Record<string, unknown>, ctx: ResolveContext) => Element[];
}

export interface ResolveContext {
  sceneDurationSec: number;
  accent: string;
  palette: Palette;
  fonts: ThemeFonts;
  fps: number;
}

export interface ThemeFonts { display: string; body: string; code: string; }

// Palette type
export interface Palette {
  bg: string;
  surface: string;
  surfaceElevated: string;
  overlay: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  glow: string;
  shadow: string;
  shadowDeep: string;
  blurAmount: number;
  radiusBlock: number;
  radiusSmall: number;
  deco3dPrimary: string;
  deco3dSecondary: string;
}

// Defaults
export const DEFAULTS = {
  fps: 30,
  width: 1920,
  height: 1080,
  subtitleFontSize: 28,
  transitionFrames: 15,
  commentaryDurationSec: 4,
  commentaryMaxChars: 140,
} as const;
