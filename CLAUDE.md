# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A headless React component library (`editable-dashboard`) for building dashboard layouts with drag-and-drop. Published to npm as a pure data/logic library with zero UI dependencies. Users bring their own UI and animation.

Very important to always keep it headless, dependency-free, and framework-agnostic. The React integration is just one adapter layer.

## Commands

```bash
npm run dev              # Dev server (port 4174) — runs the demo app
npm run build            # Full build (tsc + vite)
npm run build:lib        # Library-only build
npm run typecheck:lib    # Typecheck library without emitting
npm run lint             # ESLint
npm run test             # Vitest unit tests (single run)
npx vitest run src/lib/dashboard/engine/__tests__/some-file.test.ts  # Single test file
npm run test:e2e         # Playwright e2e tests (needs dev server running)
npm run test:e2e:ui      # Playwright with UI
```

## Architecture

### Two build targets

- **Library** (`src/lib/dashboard/`): Published package. Built via `vite.config.lib.ts` into dual ESM/CJS. Entry at `src/lib/dashboard/index.ts`.
- **Demo app** (`src/app/`): Development playground. Built via `vite.config.ts`. Not published.

### Library layers (src/lib/dashboard/)

```
engine/        → Framework-agnostic drag state machine. The core of the library.
                 Manages zones, intents, operations, dwell timers, hysteresis.
layout/        → Bin-packing layout algorithm (compute-layout.ts), ResizeObserver
                 cache (measure-cache.ts), responsive columns.
state/         → Reducer (dashboard-reducer.ts), undo history, memoized actions.
react/         → React integration hooks. DashboardProvider is the root context.
                 Two contexts: DashboardStableContext (stable) + DashboardDragContext (volatile).
types/         → All type definitions, organized by domain.
persistence/   → Serialization with versioned format (v1→v2 migration).
```

### Key patterns

- **Engine is headless**: `drag-engine.ts` is a state machine (`idle → pending → dragging → dropping → idle`) with no React dependency. React hooks in `react/` wire it up.
- **Zone → Intent → Operation pipeline**: Pointer position resolves to a DropZone, dwell timers convert zones into OperationIntents, which produce committed operations applied via the reducer.
- **Two-context split**: Stable context (state, layout, actions) doesn't re-render during drag. Volatile drag context (phase, dragState) updates every frame.
- **Controlled/uncontrolled**: DashboardProvider supports both modes — parent manages state, or provider manages internally.

### Drag operations

Reorder (gap drop), Swap (immediate on hover), Auto-resize (600ms dwell), Column-shift, Empty-row maximize, External drag-to-add (HTML5 DnD), Trash zone removal.

## Testing rules

**Never modify test files.** Tests are the specification — only change production code to match expected test behavior. When tests fail, fix the engine/production code, not the assertions.

## Validation

After every larger chunk of work, spawn multiple agents in parallel to verify everything passes:

- Unit tests (`npm run test`)
- Linting (`npm run lint`)
- Type checking (`npm run typecheck:lib`)
- E2E tests (`npm run test:e2e` — needs dev server running)

## Plan Mode

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, give me a list of unresolved questions to answer, if any.

## E2E Test Conventions

**Always use the existing util patterns** found in the test files. No custom logic — every action and assertion should go through shared utils.

### Position notation

Letters represent widgets. Doubled letters = colSpan 2. Same line = same row. Different lines = different rows. `x` = empty droppable space.

```
A B C    → 3 widgets, row 1
D        → 1 widget, row 2

A A B    → A has colSpan 2, B has colSpan 1
C        → C on row 2

A B C
x D      → empty space before D on row 2
```

### Action notation

`X -> Y` = drag X, drop on Y.
`|` = hold position while dragging.
`<` / `>` = cursor position relative to center of stationary widget (left/right side).

```
Positions:
X Y

X -> Y          → drag X, drop on Y
X ->| Y         → drag X, hold on Y before releasing

X X
Y

Y ->| <X        → drag Y, hold on left side of X
Y ->| X>        → drag Y, hold on right side of X
```

## Tech stack

TypeScript 5.9, React 18+ (peer dep), Vite 8, Vitest, Playwright, ESLint

## Comments

- Only add short and concise JSDoc comments on the public facing APIs. Remove every other comment. The code should be self-explanatory. If you find yourself writing a comment to explain what the code is doing, refactor the code until it's clear without comments. (Use the strip-comments.sh script if needed)
