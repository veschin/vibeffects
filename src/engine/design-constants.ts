// Central source of truth for all pixel sizes and layout constants.
// No magic numbers in components — import from here.

export const DESIGN = {
  // Scene layout
  scenePadding: 60,
  elementGap: 24,
  headingHeight: 80,

  // Focus phase: element occupies 78% width, 72% height of viewport, centered
  focusRatios: { width: 0.78, height: 0.72 },

  // Grid layout
  gridColumns: 2,
  gridGap: 20,

  // Typography
  subtitleFontSize: 28,
  commentaryFontSize: 18,
  headingFontSize: 48,
  bodyFontSize: 22,
  codeFontSize: 18,

  // Subtitle overlay
  subtitleBottom: 60,
  subtitleTop: 40,
  subtitlePillPaddingX: 24,
  subtitlePillPaddingY: 10,
  subtitlePillRadius: 12,

  // Commentary overlay
  commentaryTop: 20,
  commentaryRight: 40,
  commentaryPaddingX: 20,
  commentaryPaddingY: 12,
  commentaryRadius: 12,
  commentaryMaxWidth: 480,

  // Animation
  springTransitionSec: 0.85,
  fadeOutFrames: 18,
  entranceDamping: 200,
  subtitleFadeFrames: 6,

  // Watermark
  watermarkBottom: 20,
  watermarkRight: 30,
  watermarkOpacity: 0.3,

  // Viewport defaults
  defaultWidth: 1920,
  defaultHeight: 1080,
} as const;

export type DesignConstants = typeof DESIGN;
