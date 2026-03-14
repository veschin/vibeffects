import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";

const PROJECTS_DIR = path.resolve(__dirname, "../projects");

// ANSI colors
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + "GB";
  }
  return (bytes / (1024 * 1024)).toFixed(0) + "MB";
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getAudioDuration(filePath: string): string | null {
  try {
    const result = child_process.execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    );
    const durationSec = parseFloat(result.trim());
    if (isNaN(durationSec)) return null;
    return formatDuration(durationSec * 1000);
  } catch {
    return null;
  }
}

// Deterministic hash — must match capture-web.mjs and WebSlide.tsx
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash + chr) | 0;
  }
  return Math.abs(hash).toString(36).slice(0, 12);
}

function urlToFilename(url: string): string {
  const host = new URL(url).hostname.replace(/\./g, "_");
  return `${host}_${simpleHash(url)}.png`;
}

interface AudioInfo {
  filePath: string;
  fileName: string;
  size: number;
  duration: string | null;
}

interface TranscriptionInfo {
  wordCount: number;
  durationMs: number;
}

interface ScenarioInfo {
  sceneCount: number;
  commentaryCount: number;
}

interface AssetsInfo {
  total: number;
  found: number;
  missing: string[];
}

interface CaptureInfo {
  total: number;
  found: number;
  missingUrls: string[];
}

interface VideoInfo {
  filePath: string;
  fileName: string;
  size: number;
}

interface ProjectStatus {
  name: string;
  audio: AudioInfo | null;
  transcription: TranscriptionInfo | null;
  scenario: ScenarioInfo | null;
  assets: AssetsInfo | null;
  capture: CaptureInfo | null;
  video: VideoInfo | null;
}

function findAudioFile(projectDir: string): AudioInfo | null {
  const audioDir = path.join(projectDir, "audio");
  const searchDirs = [audioDir, projectDir];
  const exts = [".mp3", ".mp4", ".wav", ".m4a", ".ogg", ".flac"];

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        const ext = path.extname(entry).toLowerCase();
        if (exts.includes(ext)) {
          const filePath = path.join(dir, entry);
          const stat = fs.statSync(filePath);
          if (stat.isFile()) {
            return {
              filePath,
              fileName: entry,
              size: stat.size,
              duration: getAudioDuration(filePath),
            };
          }
        }
      }
    } catch {
      // skip unreadable dirs
    }
  }
  return null;
}

function checkTranscription(projectDir: string): TranscriptionInfo | null {
  const filePath = path.join(projectDir, "transcription.json");
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (!raw) return null;
    const data = JSON.parse(raw);
    const wordCount = Array.isArray(data.words) ? data.words.length : 0;
    const durationMs =
      typeof data.durationMs === "number"
        ? data.durationMs
        : Array.isArray(data.words) && data.words.length > 0
        ? data.words[data.words.length - 1].endMs ?? 0
        : 0;
    if (wordCount === 0) return null;
    return { wordCount, durationMs };
  } catch {
    return null;
  }
}

function checkScenario(projectDir: string): ScenarioInfo | null {
  const filePath = path.join(projectDir, "spec.json");
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data.scenes) || data.scenes.length === 0) return null;
    const commentaryCount = Array.isArray(data.commentary)
      ? data.commentary.length
      : 0;
    return { sceneCount: data.scenes.length, commentaryCount };
  } catch {
    return null;
  }
}

function collectSrcFields(obj: unknown): string[] {
  if (!obj || typeof obj !== "object") return [];
  const results: string[] = [];
  if (Array.isArray(obj)) {
    for (const item of obj) {
      results.push(...collectSrcFields(item));
    }
  } else {
    const rec = obj as Record<string, unknown>;
    for (const key of Object.keys(rec)) {
      if (key === "src" && typeof rec[key] === "string") {
        results.push(rec[key] as string);
      } else {
        results.push(...collectSrcFields(rec[key]));
      }
    }
  }
  return results;
}

function collectWebScrollUrls(obj: unknown): string[] {
  if (!obj || typeof obj !== "object") return [];
  const results: string[] = [];
  if (Array.isArray(obj)) {
    for (const item of obj) {
      results.push(...collectWebScrollUrls(item));
    }
  } else {
    const rec = obj as Record<string, unknown>;
    if (rec["pattern"] === "web-scroll" && typeof rec["url"] === "string") {
      results.push(rec["url"] as string);
    }
    for (const key of Object.keys(rec)) {
      if (key !== "url") {
        results.push(...collectWebScrollUrls(rec[key]));
      }
    }
  }
  return results;
}

function checkAssets(projectDir: string): AssetsInfo | null {
  const specPath = path.join(projectDir, "spec.json");
  if (!fs.existsSync(specPath)) return null;
  let spec: unknown;
  try {
    spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  } catch {
    return null;
  }

  const srcs = collectSrcFields(spec);
  if (srcs.length === 0) return { total: 0, found: 0, missing: [] };

  const assetsDir = path.join(projectDir, "assets");
  const missing: string[] = [];
  for (const src of srcs) {
    // src may be an absolute path, relative to assets/, or relative to project root
    const basename = path.basename(src);
    const inAssets = path.join(assetsDir, basename);
    const inProject = path.join(projectDir, src);
    if (!fs.existsSync(inAssets) && !fs.existsSync(inProject)) {
      missing.push(basename);
    }
  }

  return { total: srcs.length, found: srcs.length - missing.length, missing };
}

function checkCaptures(projectDir: string): CaptureInfo | null {
  const specPath = path.join(projectDir, "spec.json");
  if (!fs.existsSync(specPath)) return null;
  let spec: unknown;
  try {
    spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  } catch {
    return null;
  }

  const urls = collectWebScrollUrls(spec);
  if (urls.length === 0) return { total: 0, found: 0, missingUrls: [] };

  const capturesDir = path.resolve(__dirname, "../public/web-captures");
  const missingUrls: string[] = [];
  for (const url of urls) {
    try {
      const filename = urlToFilename(url);
      const capturePath = path.join(capturesDir, filename);
      if (!fs.existsSync(capturePath)) {
        missingUrls.push(url);
      }
    } catch {
      missingUrls.push(url);
    }
  }

  return {
    total: urls.length,
    found: urls.length - missingUrls.length,
    missingUrls,
  };
}

function findVideoFile(projectDir: string): VideoInfo | null {
  const outDir = path.join(projectDir, "out");
  if (!fs.existsSync(outDir)) return null;
  try {
    const entries = fs.readdirSync(outDir);
    for (const entry of entries) {
      if (path.extname(entry).toLowerCase() === ".mp4") {
        const filePath = path.join(outDir, entry);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          return { filePath, fileName: entry, size: stat.size };
        }
      }
    }
  } catch {
    // skip
  }
  return null;
}

function getProjectStatus(name: string): ProjectStatus {
  const projectDir = path.join(PROJECTS_DIR, name);
  return {
    name,
    audio: findAudioFile(projectDir),
    transcription: checkTranscription(projectDir),
    scenario: checkScenario(projectDir),
    assets: checkAssets(projectDir),
    capture: checkCaptures(projectDir),
    video: findVideoFile(projectDir),
  };
}

function listProjects(): string[] {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  return fs
    .readdirSync(PROJECTS_DIR)
    .filter((entry) => {
      if (entry.startsWith("_")) return false;
      const full = path.join(PROJECTS_DIR, entry);
      return fs.statSync(full).isDirectory();
    })
    .sort();
}

// ─── Table drawing helpers ─────────────────────────────────────────────────

function padCenter(s: string, width: number): string {
  const len = stripAnsi(s).length;
  const total = width - len;
  const left = Math.floor(total / 2);
  const right = total - left;
  return " ".repeat(left) + s + " ".repeat(right);
}

function padRight(s: string, width: number): string {
  const len = stripAnsi(s).length;
  return s + " ".repeat(Math.max(0, width - len));
}

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function check(done: boolean): string {
  return done ? green("✓") : dim("·");
}

function assetsCheck(assets: AssetsInfo | null): string {
  if (!assets) return dim("·");
  if (assets.total === 0) return dim("—");
  if (assets.missing.length === 0) return green("✓");
  return yellow("!");
}

function captureCheck(capture: CaptureInfo | null): string {
  if (!capture) return dim("·");
  if (capture.total === 0) return dim("—");
  if (capture.missingUrls.length === 0) return green("✓");
  return yellow("!");
}

function statusTable(projects: ProjectStatus[]): void {
  const cols = {
    project: Math.max(7, ...projects.map((p) => p.name.length)) + 2,
    audio: 7,
    trans: 7,
    scenario: 10,
    assets: 8,
    capture: 9,
    studio: 8,
    video: 7,
  };

  const colWidths = [
    cols.project,
    cols.audio,
    cols.trans,
    cols.scenario,
    cols.assets,
    cols.capture,
    cols.studio,
    cols.video,
  ];

  const hline = (l: string, m: string, r: string) => {
    return (
      l +
      colWidths.map((w) => "─".repeat(w)).join(m) +
      r
    );
  };

  console.log(hline("┌", "┬", "┐"));

  console.log(
    "│" +
      padCenter(bold("Project"), cols.project) +
      "│" +
      padCenter(bold("Audio"), cols.audio) +
      "│" +
      padCenter(bold("Trans"), cols.trans) +
      "│" +
      padCenter(bold("Scenario"), cols.scenario) +
      "│" +
      padCenter(bold("Assets"), cols.assets) +
      "│" +
      padCenter(bold("Capture"), cols.capture) +
      "│" +
      padCenter(bold("Studio"), cols.studio) +
      "│" +
      padCenter(bold("Video"), cols.video) +
      "│"
  );

  console.log(hline("├", "┼", "┤"));

  for (const p of projects) {
    const studioReady = p.scenario !== null;
    console.log(
      "│" +
        padRight(" " + p.name, cols.project) +
        "│" +
        padCenter(check(p.audio !== null), cols.audio) +
        "│" +
        padCenter(check(p.transcription !== null), cols.trans) +
        "│" +
        padCenter(check(p.scenario !== null), cols.scenario) +
        "│" +
        padCenter(assetsCheck(p.assets), cols.assets) +
        "│" +
        padCenter(captureCheck(p.capture), cols.capture) +
        "│" +
        padCenter(check(studioReady), cols.studio) +
        "│" +
        padCenter(check(p.video !== null), cols.video) +
        "│"
    );
  }

  console.log(hline("└", "┴", "┘"));
}

function statusDetailed(p: ProjectStatus): void {
  console.log(bold("Project: " + cyan(p.name)));

  // Audio
  if (p.audio) {
    const details = [
      p.audio.fileName,
      p.audio.duration ? `(${p.audio.duration})` : null,
      formatSize(p.audio.size),
    ]
      .filter(Boolean)
      .join(" ");
    console.log(`  ${green("✓")} Audio         ${details}`);
  } else {
    console.log(`  ${dim("·")} Audio         ${dim("not found")}`);
  }

  // Transcription
  if (p.transcription) {
    const details = `${p.transcription.wordCount.toLocaleString()} words, ${Math.round(p.transcription.durationMs / 1000)}s`;
    console.log(`  ${green("✓")} Transcription ${details}`);
  } else {
    console.log(`  ${dim("·")} Transcription ${dim("not yet generated")}`);
  }

  // Scenario
  if (p.scenario) {
    const parts = [`${p.scenario.sceneCount} scenes`];
    if (p.scenario.commentaryCount > 0) {
      parts.push(`${p.scenario.commentaryCount} commentary`);
    }
    console.log(`  ${green("✓")} Scenario      ${parts.join(", ")}`);
  } else {
    console.log(`  ${dim("·")} Scenario      ${dim("not yet generated")}`);
  }

  // Assets
  if (p.assets === null) {
    console.log(`  ${dim("·")} Assets        ${dim("—")}`);
  } else if (p.assets.total === 0) {
    console.log(`  ${dim("—")} Assets        ${dim("none referenced")}`);
  } else if (p.assets.missing.length === 0) {
    console.log(`  ${green("✓")} Assets        ${p.assets.found}/${p.assets.total} found`);
  } else {
    const missingList = p.assets.missing.join(", ");
    console.log(
      `  ${yellow("!")} Assets        ${p.assets.found}/${p.assets.total} found — missing: ${missingList}`
    );
  }

  // Capture
  if (p.capture === null) {
    console.log(`  ${dim("·")} Capture       ${dim("—")}`);
  } else if (p.capture.total === 0) {
    console.log(`  ${dim("—")} Capture       ${dim("no web-scroll slides")}`);
  } else if (p.capture.missingUrls.length === 0) {
    console.log(`  ${green("✓")} Capture       ${p.capture.found} web capture${p.capture.found !== 1 ? "s" : ""} ready`);
  } else {
    console.log(
      `  ${yellow("!")} Capture       needs capture: ${p.capture.missingUrls.length} URL${p.capture.missingUrls.length !== 1 ? "s" : ""}`
    );
  }

  // Studio (derived from scenario)
  if (p.scenario) {
    console.log(`  ${green("✓")} Studio        ${dim("ready for review")}`);
  } else {
    console.log(`  ${dim("·")} Studio        ${dim("—")}`);
  }

  // Video
  if (p.video) {
    console.log(
      `  ${green("✓")} Video         ${p.video.fileName} (${formatSize(p.video.size)})`
    );
  } else {
    console.log(`  ${dim("·")} Video         ${dim("—")}`);
  }
}

function nextAction(p: ProjectStatus): void {
  console.log(bold("Project: " + cyan(p.name)));
  console.log();

  if (!p.audio) {
    console.log(bold("Next:") + " add audio file");
    console.log();
    console.log(`  Place an mp3/mp4/wav file in:`);
    console.log(dim(`    projects/${p.name}/audio/`));
    console.log(`  Or directly in:`);
    console.log(dim(`    projects/${p.name}/`));
    return;
  }

  if (!p.transcription) {
    const audioRel = path.relative(
      path.resolve(__dirname, ".."),
      p.audio.filePath
    );
    console.log(bold("Next:") + " transcribe audio");
    console.log();
    console.log(`  make transcribe AUDIO=${audioRel}`);
    console.log();
    console.log(dim("Or interactively:"));
    console.log(
      dim(`  npx tsx scripts/transcribe.ts "${audioRel}"`)
    );
    return;
  }

  if (!p.scenario) {
    console.log(bold("Next:") + " write scenario interactively in Claude Code");
    console.log();
    console.log(dim(`  Open Claude Code and say:`));
    console.log(
      dim(
        `  "Read projects/${p.name}/transcription.json and generate spec.json"`
      )
    );
    return;
  }

  if (p.assets && p.assets.missing.length > 0) {
    console.log(bold("Next:") + " add missing assets");
    console.log();
    console.log(`  Place the following files in projects/${p.name}/assets/:`);
    for (const f of p.assets.missing) {
      console.log(`    ${yellow("·")} ${f}`);
    }
    return;
  }

  if (p.capture && p.capture.missingUrls.length > 0) {
    console.log(bold("Next:") + " capture web screenshots");
    console.log();
    console.log(`  make capture PROJECT=${p.name}`);
    return;
  }

  if (!p.video) {
    console.log(bold("Next:") + " review in Studio, then render");
    console.log();
    console.log(`  make studio PROJECT=${p.name}`);
    console.log();
    console.log(dim("When ready to render:"));
    console.log(`  make render PROJECT=${p.name}`);
    return;
  }

  console.log(green("All stages complete."));
  console.log();
  console.log(dim(`  Output: projects/${p.name}/out/${p.video.fileName}`));
}

// ─── CLI ───────────────────────────────────────────────────────────────────

const [, , command, projectArg] = process.argv;

if (!command || command === "status") {
  if (projectArg) {
    const p = getProjectStatus(projectArg);
    statusDetailed(p);
  } else {
    const names = listProjects();
    if (names.length === 0) {
      console.log(dim("No projects found in projects/"));
      process.exit(0);
    }
    const statuses = names.map(getProjectStatus);
    statusTable(statuses);
  }
} else if (command === "next") {
  if (!projectArg) {
    console.error("Usage: pipeline.ts next <PROJECT>");
    process.exit(1);
  }
  const p = getProjectStatus(projectArg);
  nextAction(p);
} else {
  console.error(`Unknown command: ${command}`);
  console.error("Usage: pipeline.ts status [PROJECT] | next <PROJECT>");
  process.exit(1);
}
