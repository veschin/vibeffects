# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run build              # TypeScript check (tsc --noEmit)
npm run studio             # Remotion Studio preview (localhost:3000)
npm run render             # Render video to MP4

make studio PROJECT=name   # Studio with project context
make render PROJECT=name   # Software render → projects/name/out/name.mp4
make render-hw PROJECT=name # GPU render (NVIDIA h264_nvenc)
make init PROJECT=name     # Scaffold new project directory
make transcribe PROJECT=name # Whisper audio → transcription.json
make validate PROJECT=name # Zod validation of spec.json
make pipeline PROJECT=name # Full pipeline status display
```

### Testing

```bash
npx vitest                 # Run all tests
npx vitest run             # Single run (no watch)
npx vitest run src/engine  # Run tests in specific directory
```

Vitest config: jsdom environment, `@/*` → `src/*` path alias, globals enabled.

## Architecture

**Vibeffects v2** — a Remotion-based video generation engine that renders educational/explainer videos from declarative JSON specs.

### Data Flow

```
audio.wav → Whisper → transcription.json
                              ↓
                    spec.json (VideoSpec)
                              ↓
              Remotion (React components) → MP4
```

### Three-Layer Content System

1. **Elements** (14 types) — atomic visual components: text, heading, code, image, bulletList, table, graph, chart, icon, divider, badge, progress, counter, callout. All share `id`, `enterSec`, `exitSec?`, `position?`, `animation?`.

2. **Patterns** (26 recipes) — expand to multiple elements with layout/timing via `PATTERN_REGISTRY`. Each pattern has a Zod schema and `resolve(params, ctx) → Element[]`.

3. **Scenes** — timed containers mixing patterns + raw elements, with accent color and background config.

### Key Modules

- `src/engine/types.ts` — All TypeScript types (VideoSpec, Element unions, Palette, Transcription)
- `src/engine/schema.ts` — Zod validation schemas mirroring types.ts
- `src/Root.tsx` / `src/Composition.tsx` — Remotion entry points
- `scripts/pipeline.ts` — CLI pipeline status tracker
- `scripts/convert-whisper.mjs` — Whisper output conversion

### Theme System (4-level cascade)

Engine defaults → `~/.vibeffects/theme.json` → `projects/<P>/custom/theme.json` → inline `spec.json.theme`

6 palette presets: dark-cosmos, warm-ember, deep-ocean, nibelung, rose-quartz, acid-neon.

### Stage Layout Engine

`calculateElementStates(frame, fps, elements)` manages element lifecycle phases: hidden → focus (78%×72% center) → refocus → grid. Spring interpolation (0.85s) for transitions.

### Key Dependencies

- Remotion 4.0 (video framework), React 18, TypeScript 5.7
- Zod 3.23 (schema validation), ELK.js 0.9 (graph layout), Prism.js 1.29 (syntax highlighting)

## Project Structure

Each video project lives in `projects/<name>/` with: `audio/`, `assets/`, `custom/`, `out/`, `spec.json`, `transcription.json`.

BDD features, seed data, and pipeline state live in `.ptsd/`.

---

<!-- ---ptsd--- -->
# Claude Agent Instructions

## Authority Hierarchy (ENFORCED BY HOOKS)

PTSD (iron law) > User (context provider) > Assistant (executor)

- PTSD decides what CAN and CANNOT be done. Pipeline, gates, validation — non-negotiable.
  Hooks enforce this automatically — writes that violate pipeline are BLOCKED.
- User provides context and requirements. User also follows ptsd rules.
- Assistant executes within ptsd constraints. Writes code, docs, tests on behalf of user.

## Session Start Protocol

EVERY session, BEFORE any work:
1. Run: ptsd context --agent — see full pipeline state
2. Run: ptsd task next --agent — get next task
3. Follow output exactly.

## Commands (always use --agent flag)

- ptsd context --agent              — full pipeline state (auto-injected by hooks)
- ptsd status --agent               — project overview
- ptsd task next --agent            — next task to work on
- ptsd task update <id> --status WIP — mark task in progress
- ptsd validate --agent             — check pipeline before commit
- ptsd feature list --agent         — list all features
- ptsd seed init <id> --agent       — initialize seed directory
- ptsd gate-check --file <path> --agent — check if file write is allowed

## Skills

PTSD pipeline skills are in `.claude/skills/` — auto-loaded when relevant.

| Skill | When to Use |
|-------|------------|
| write-prd | Creating or updating a PRD section |
| write-seed | Creating seed data for a feature |
| write-bdd | Writing Gherkin BDD scenarios |
| write-tests | Writing tests from BDD scenarios |
| write-impl | Implementing to make tests pass |
| create-tasks | Adding tasks to tasks.yaml |
| review-prd | Reviewing PRD before advancing to seed |
| review-seed | Reviewing seed data before advancing to bdd |
| review-bdd | Reviewing BDD before advancing to tests |
| review-tests | Reviewing tests before advancing to impl |
| review-impl | Reviewing implementation after tests pass |
| workflow | Session start or when unsure what to do next |
| adopt | Bootstrapping existing project into PTSD |

Use the corresponding write skill, then review skill at each pipeline stage.

## Pipeline (strict order, no skipping)

PRD → Seed → BDD → Tests → Implementation

Each stage requires review score ≥ 7 before advancing.
Hooks enforce gates automatically — blocked writes show the reason.

## Rules

- NO mocks for internal code. Real tests, real files, temp directories.
- NO garbage files. Every file must link to a feature.
- NO hiding errors. Explain WHY something failed.
- NO over-engineering. Minimum code for the current task.
- ALWAYS run: ptsd validate --agent before committing.
- COMMIT FORMAT: [SCOPE] type: message
  Scopes: PRD, SEED, BDD, TEST, IMPL, TASK, STATUS
  Types: feat, add, fix, refactor, remove, update

## Troubleshooting

When ptsd status/validate shows unexpected results, debug with these steps:

| Symptom | Cause | Fix |
|---------|-------|-----|
| TESTS:0 but test files exist | Tests not mapped to features | `ptsd test map .ptsd/bdd/<id>.feature <test-file>` for each feature |
| BDD:0 but .feature files exist | State hashes empty, SyncState not run | `ptsd status --agent` triggers sync; if still 0, check `.ptsd/bdd/<id>.feature` has `@feature:<id>` tag on line 1 |
| Feature stuck at wrong stage | review-status.yaml stale or stage not advanced | Run `ptsd review <id> <stage> <score>` to advance; check `ptsd context --agent` for blockers |
| "no test files mapped" on `ptsd test run` | Test mapping missing in state.yaml | `ptsd test map .ptsd/bdd/<id>.feature <test-file>` |
| Gate blocks file write | File not in allowed list for current stage | Check `ptsd gate-check --file <path> --agent`; advance feature to correct stage first |
| Validate shows "mock detected" | Test file contains mock/stub patterns | Replace mocks with real file-based tests in temp directories |
| Regression warning on status | Artifact file changed after stage was reviewed | Re-review the stage: `ptsd review <id> <stage> <score>` |

### Debug flow
1. `ptsd context --agent` — shows next action, blockers, stage per feature
2. `ptsd feature show <id> --agent` — shows artifact counts and test stats
3. `ptsd validate --agent` — shows all pipeline violations
4. Check `.ptsd/state.yaml` — hashes, test mappings, stages
5. Check `.ptsd/review-status.yaml` — review verdicts per feature

### Test mapping
Each feature needs: BDD file (`.ptsd/bdd/<id>.feature`) with `@feature:<id>` tag → mapped to test file via `ptsd test map`. Without mapping, ptsd cannot track test results per feature.

## Forbidden

- Mocking internal code
- Skipping pipeline steps
- Hiding errors or pretending something works
- Generating files not linked to a feature
- Using --force, --skip-validation, --no-verify

<!-- ---ptsd--- -->
