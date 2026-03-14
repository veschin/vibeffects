import type { SceneSpec, Element } from "./types";
import { DEFAULTS } from "./types";

/**
 * Total duration in frames from the max scene endSec.
 * Empty scenes → 1 frame (Remotion requires at least 1).
 */
export function getTotalDurationFrames(
  scenes: SceneSpec[],
  fps: number = DEFAULTS.fps,
): number {
  if (scenes.length === 0) return 1;
  const maxEnd = Math.max(...scenes.map((s) => s.endSec));
  return Math.ceil(maxEnd * fps);
}

/**
 * Duration of a single scene in frames.
 */
export function getSceneDurationFrames(
  scene: SceneSpec,
  fps: number = DEFAULTS.fps,
): number {
  return Math.ceil((scene.endSec - scene.startSec) * fps);
}

/**
 * Whether an element is visible at a given absolute time (seconds).
 * enterSec is relative to scene start.
 * exitSec is relative to scene start (if provided).
 */
export function isElementVisible(
  element: { enterSec: number; exitSec?: number },
  sceneStartSec: number,
  absoluteTimeSec: number,
): boolean {
  const localTime = absoluteTimeSec - sceneStartSec;
  if (localTime < element.enterSec) return false;
  if (element.exitSec !== undefined && localTime >= element.exitSec) return false;
  return true;
}

/**
 * Convert absolute frame number to absolute time in seconds.
 */
export function frameToSec(frame: number, fps: number = DEFAULTS.fps): number {
  return frame / fps;
}

/**
 * Convert absolute time in seconds to frame number.
 */
export function secToFrame(sec: number, fps: number = DEFAULTS.fps): number {
  return Math.round(sec * fps);
}
