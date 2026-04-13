import { test, expect } from "@playwright/test";
import { setupDashboard } from "./helpers/setup";
import { assertLayout, capturePreviewGrid, getGridRepresentation } from "./helpers/layout-utils";
import { dragByIdToCoords } from "./helpers/drag";
import { widgetById, widgetDragHandleById } from "./helpers/locators";
import { defineScenarios, type ScenarioGroup } from "./helpers/scenario-runner";

// ═══════════════════════════════════════════════════════════════════
//  2-col layouts
// ═══════════════════════════════════════════════════════════════════

const twoColGroups: ScenarioGroup[] = [
  {
    group: "2-col: A B",
    layout: ["A B"],
    scenarios: [
      { name: "A -> B", action: { do: "swap", source: "a", target: "b" }, expected: [["b", "a"]] },
    ],
  },

  {
    group: "2-col: A B / C",
    layout: ["A B", "C"],
    scenarios: [
      { name: "A -> B", action: { do: "swap", source: "a", target: "b" }, expected: [["b", "a"], ["c"]] },
      { name: "B -> A", action: { do: "swap", source: "b", target: "a" }, expected: [["b", "a"], ["c"]] },
      { name: "A -> C", action: { do: "swap", source: "a", target: "c" }, expected: [["c", "b"], ["a"]] },
      { name: "C -> A", action: { do: "swap", source: "c", target: "a" }, expected: [["c", "b"], ["a"]] },
      { name: "B -> C", action: { do: "swap", source: "b", target: "c" }, expected: [["a", "c"], ["b"]] },
    ],
  },

  {
    group: "2-col: A B / C D",
    layout: ["A B", "C D"],
    scenarios: [
      // swaps
      { name: "A -> D", action: { do: "swap", source: "a", target: "d" }, expected: [["d", "b"], ["c", "a"]] },
      { name: "D -> A", action: { do: "swap", source: "d", target: "a" }, expected: [["d", "b"], ["c", "a"]] },
      { name: "A -> C", action: { do: "swap", source: "a", target: "c" }, expected: [["c", "b"], ["a", "d"]] },
      { name: "B -> D", action: { do: "swap", source: "b", target: "d" }, expected: [["a", "d"], ["c", "b"]] },
      { name: "B -> C", action: { do: "swap", source: "b", target: "c" }, expected: [["a", "c"], ["b", "d"]] },
      // multi-step
      {
        name: "D -> A then B -> C",
        steps: [
          { action: { do: "swap", source: "d", target: "a" } },
          { action: { do: "swap", source: "b", target: "c" }, expected: [["d", "c"], ["b", "a"]] },
        ],
      },
      // cross-row side-drop (short dwell = swap, not resize)
      { name: "C -> A", action: { do: "swap", source: "c", target: "a" }, expected: [["c", "b"], ["a", "d"]] },
      { name: "C ->| <A (short dwell)", action: { do: "autoResize", source: "c", target: "a", side: "left", dwellMs: 350 }, expected: [["c", "b"], ["a", "d"]] },
      { name: "C ->| A> (short dwell)", action: { do: "autoResize", source: "c", target: "a", side: "right", dwellMs: 350 }, expected: [["c", "b"], ["a", "d"]] },
      // cross-row auto-resize (default dwell)
      { name: "C ->| <A (auto-resize left)", action: { do: "autoResize", source: "c", target: "a", side: "left" }, expected: [["c", "a"], ["b", "d"]] },
      { name: "C ->| A> (auto-resize right)", action: { do: "autoResize", source: "c", target: "a", side: "right" }, expected: [["a", "c"], ["b", "d"]] },
      // multi-step with prior operations (regression: stale columnStart)
      {
        name: "C -> A after prior B<->D swap-and-back",
        steps: [
          { action: { do: "swap", source: "b", target: "d" }, expected: [["a", "d"], ["c", "b"]] },
          { action: { do: "swap", source: "b", target: "d" }, expected: [["a", "b"], ["c", "d"]] },
          { action: { do: "swap", source: "c", target: "a" }, expected: [["c", "b"], ["a", "d"]] },
        ],
      },
      {
        name: "C ->| <A after prior swap-and-back",
        steps: [
          { action: { do: "swap", source: "b", target: "d" } },
          { action: { do: "swap", source: "b", target: "d" } },
          { action: { do: "autoResize", source: "c", target: "a", side: "left", dwellMs: 350 }, expected: [["c", "b"], ["a", "d"]] },
        ],
      },
      {
        name: "C ->| A> after prior swap-and-back",
        steps: [
          { action: { do: "swap", source: "b", target: "d" } },
          { action: { do: "swap", source: "b", target: "d" } },
          { action: { do: "autoResize", source: "c", target: "a", side: "right", dwellMs: 350 }, expected: [["c", "b"], ["a", "d"]] },
        ],
      },
      // multi-step: A -> D then C -> B
      {
        name: "A -> D then C -> B",
        steps: [
          { action: { do: "swap", source: "a", target: "d" } },
          { action: { do: "swap", source: "c", target: "b" }, expected: [["d", "c"], ["b", "a"]] },
        ],
      },
    ],
  },

  {
    group: "2-col: A B / C / D",
    layout: ["A B", "C", "D"],
    scenarios: [
      { name: "B ->| A> (side right)", action: { do: "autoResize", source: "b", target: "a", side: "right" }, expected: [["b", "a"], ["c"], ["d"]] },
      { name: "B ->| <A (side left)", action: { do: "autoResize", source: "b", target: "a", side: "left" }, expected: [["b", "a"], ["c"], ["d"]] },
      { name: "B -> A", action: { do: "swap", source: "b", target: "a" }, expected: [["b", "a"], ["c"], ["d"]] },
      { name: "D -> C", action: { do: "swap", source: "d", target: "c" }, expected: [["a", "b"], ["d"], ["c"]] },
      { name: "D ->| <C (side left)", action: { do: "autoResize", source: "d", target: "c", side: "left" }, expected: [["a", "b"], ["d"], ["c"]] },
      { name: "D ->| C> (side right)", action: { do: "autoResize", source: "d", target: "c", side: "right" }, expected: [["a", "b"], ["d"], ["c"]] },
    ],
  },

  {
    group: "2-col: A A / B",
    layout: ["A A", "B"],
    scenarios: [
      { name: "A -> B (swap)", action: { do: "swap", source: "a", target: "b" }, expected: [["b"], ["a", "a"]] },
      { name: "B ->| A> (auto-resize right)", action: { do: "autoResize", source: "b", target: "a", side: "right" }, expected: [["a", "b"]] },
      { name: "B ->| <A (auto-resize left)", action: { do: "autoResize", source: "b", target: "a", side: "left" }, expected: [["b", "a"]] },
      // regression: auto-resize after prior swap-and-back (stale columnStart)
      {
        name: "B ->| <A after prior swap-and-back",
        steps: [
          { action: { do: "swap", source: "b", target: "a" }, expected: [["b"], ["a", "a"]] },
          { action: { do: "swap", source: "a", target: "b" }, expected: [["a", "a"], ["b"]] },
          { action: { do: "autoResize", source: "b", target: "a", side: "left" }, expected: [["b", "a"]] },
        ],
      },
    ],
  },

  {
    group: "2-col: A A / B C",
    layout: ["A A", "B C"],
    scenarios: [
      { name: "A -> B (swap)", action: { do: "swap", source: "a", target: "b" }, expected: [["b"], ["a", "a"], ["c"]] },
      { name: "A -> C (swap)", action: { do: "swap", source: "a", target: "c" }, expected: [["c", "b"], ["a", "a"]] },
      { name: "B -> C", action: { do: "swap", source: "b", target: "c" }, expected: [["a", "a"], ["c", "b"]] },
      { name: "C ->| <A (auto-resize left)", action: { do: "autoResize", source: "c", target: "a", side: "left" }, expected: [["c", "a"], ["b"]] },
      { name: "C ->| A> (auto-resize right)", action: { do: "autoResize", source: "c", target: "a", side: "right" }, expected: [["a", "c"], ["b"]] },
      // regression: stale columnStart after swap-and-back
      {
        name: "swap B<->C twice then C ->| A> (stale columnStart)",
        steps: [
          { action: { do: "swap", source: "b", target: "c" }, expected: [["a", "a"], ["c", "b"]] },
          { action: { do: "swap", source: "b", target: "c" }, expected: [["a", "a"], ["b", "c"]] },
          { action: { do: "autoResize", source: "c", target: "a", side: "right" }, expected: [["a", "c"], ["b"]] },
        ],
      },
    ],
  },

  {
    group: "2-col: A A / B B",
    layout: ["A A", "B B"],
    scenarios: [
      { name: "A -> B (swap)", action: { do: "swap", source: "a", target: "b" }, expected: [["b", "b"], ["a", "a"]] },
      { name: "B ->| A> (auto-resize right)", action: { do: "autoResize", source: "b", target: "a", side: "right" }, expected: [["a", "b"]] },
      { name: "B ->| <A (auto-resize left)", action: { do: "autoResize", source: "b", target: "a", side: "left" }, expected: [["b", "a"]] },
    ],
  },

  {
    group: "2-col: A A / B C / D E",
    layout: ["A A", "B C", "D E"],
    scenarios: [
      { name: "C ->| A> (auto-resize right)", action: { do: "autoResize", source: "c", target: "a", side: "right" }, expected: [["a", "c"], ["b", "d"], ["e"]] },
      { name: "B -> E", action: { do: "swap", source: "b", target: "e" }, expected: [["a", "a"], ["e", "c"], ["d", "b"]] },
      { name: "B ->| E> (short dwell)", action: { do: "autoResize", source: "b", target: "e", side: "right", dwellMs: 350 }, expected: [["a", "a"], ["e", "c"], ["d", "b"]] },
      { name: "B ->| <E (short dwell)", action: { do: "autoResize", source: "b", target: "e", side: "left", dwellMs: 350 }, expected: [["a", "a"], ["e", "c"], ["d", "b"]] },
    ],
  },

  {
    group: "2-col: A A / B C / D",
    layout: ["A A", "B C", "D"],
    scenarios: [
      { name: "C ->| <A (auto-resize left)", action: { do: "autoResize", source: "c", target: "a", side: "left" }, expected: [["c", "a"], ["b", "d"]] },
      { name: "C ->| A> (auto-resize right)", action: { do: "autoResize", source: "c", target: "a", side: "right" }, expected: [["a", "c"], ["b", "d"]] },
    ],
  },

  {
    group: "2-col: x A / B",
    layout: ["x A", "B"],
    scenarios: [
      { name: "A -> x (drag left into empty)", action: { do: "dragToEmpty", source: "a", direction: "left" }, expected: [["a"], ["b"]] },
      { name: "A -> x> (right side of empty)", action: { do: "dragToEmpty", source: "a", direction: "left", side: "right" }, expected: [["a"], ["b"]] },
      { name: "A -> <x (left side of empty)", action: { do: "dragToEmpty", source: "a", direction: "left", side: "left" }, expected: [["a"], ["b"]] },
    ],
  },

  {
    group: "2-col: A / B B / C (raw)",
    scenarios: [
      {
        name: "B -> <A (swap, no dwell)",
        rawLayout: {
          widgets: [
            { id: "a", colSpan: 1, type: "stats", columnStart: 0 },
            { id: "b", colSpan: 2, type: "chart", columnStart: 0 },
            { id: "c", colSpan: 1, type: "notes", columnStart: 0 },
          ],
          maxColumns: 2,
        },
        action: { do: "autoResize", source: "b", target: "a", side: "left", dwellMs: 150 },
        expected: [["b", "b"], ["a"], ["c"]],
      },
      {
        name: "A -> <B (swap, no dwell)",
        rawLayout: {
          widgets: [
            { id: "a", colSpan: 1, type: "stats", columnStart: 0 },
            { id: "b", colSpan: 2, type: "chart", columnStart: 0 },
            { id: "c", colSpan: 1, type: "notes", columnStart: 0 },
          ],
          maxColumns: 2,
        },
        action: { do: "autoResize", source: "a", target: "b", side: "left", dwellMs: 150 },
        expected: [["b", "b"], ["a"], ["c"]],
      },
    ],
  },

  {
    group: "2-col: A B / C C / D (raw)",
    scenarios: [
      {
        name: "C -> A (swap)",
        rawLayout: {
          widgets: [
            { id: "a", colSpan: 1, type: "stats" },
            { id: "b", colSpan: 1, type: "calendar" },
            { id: "c", colSpan: 2, type: "chart" },
            { id: "d", colSpan: 1, type: "notes", columnStart: 0 },
          ],
          maxColumns: 2,
        },
        action: { do: "swap", source: "c", target: "a" },
        expected: [["c", "c"], ["a", "b"], ["d"]],
      },
      {
        name: "C ->| <A (short dwell)",
        rawLayout: {
          widgets: [
            { id: "a", colSpan: 1, type: "stats" },
            { id: "b", colSpan: 1, type: "calendar" },
            { id: "c", colSpan: 2, type: "chart" },
            { id: "d", colSpan: 1, type: "notes", columnStart: 0 },
          ],
          maxColumns: 2,
        },
        action: { do: "autoResize", source: "c", target: "a", side: "left", dwellMs: 350 },
        expected: [["c", "c"], ["a", "b"], ["d"]],
      },
      {
        name: "C ->| A> (short dwell)",
        rawLayout: {
          widgets: [
            { id: "a", colSpan: 1, type: "stats" },
            { id: "b", colSpan: 1, type: "calendar" },
            { id: "c", colSpan: 2, type: "chart" },
            { id: "d", colSpan: 1, type: "notes", columnStart: 0 },
          ],
          maxColumns: 2,
        },
        action: { do: "autoResize", source: "c", target: "a", side: "right", dwellMs: 350 },
        expected: [["c", "c"], ["a", "b"], ["d"]],
      },
    ],
  },

  {
    group: "2-col: A A / B C / D E (raw)",
    scenarios: [
      {
        name: "B -> E",
        rawLayout: {
          widgets: [
            { id: "a", colSpan: 2, type: "stats", columnStart: 0 },
            { id: "b", colSpan: 1, type: "chart", columnStart: 0 },
            { id: "c", colSpan: 1, type: "notes", columnStart: 1 },
            { id: "d", colSpan: 1, type: "calendar", columnStart: 0 },
            { id: "e", colSpan: 1, type: "table", columnStart: 1 },
          ],
          maxColumns: 2,
        },
        action: { do: "swap", source: "b", target: "e" },
        expected: [["a", "a"], ["e", "c"], ["d", "b"]],
      },
      {
        name: "B ->| <E (short dwell)",
        rawLayout: {
          widgets: [
            { id: "a", colSpan: 2, type: "stats", columnStart: 0 },
            { id: "b", colSpan: 1, type: "chart", columnStart: 0 },
            { id: "c", colSpan: 1, type: "notes", columnStart: 1 },
            { id: "d", colSpan: 1, type: "calendar", columnStart: 0 },
            { id: "e", colSpan: 1, type: "table", columnStart: 1 },
          ],
          maxColumns: 2,
        },
        action: { do: "autoResize", source: "b", target: "e", side: "left", dwellMs: 350 },
        expected: [["a", "a"], ["e", "c"], ["d", "b"]],
      },
      {
        name: "B ->| E> (short dwell)",
        rawLayout: {
          widgets: [
            { id: "a", colSpan: 2, type: "stats", columnStart: 0 },
            { id: "b", colSpan: 1, type: "chart", columnStart: 0 },
            { id: "c", colSpan: 1, type: "notes", columnStart: 1 },
            { id: "d", colSpan: 1, type: "calendar", columnStart: 0 },
            { id: "e", colSpan: 1, type: "table", columnStart: 1 },
          ],
          maxColumns: 2,
        },
        action: { do: "autoResize", source: "b", target: "e", side: "right", dwellMs: 350 },
        expected: [["a", "a"], ["e", "c"], ["d", "b"]],
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
//  3-col layouts
// ═══════════════════════════════════════════════════════════════════

const threeColGroups: ScenarioGroup[] = [
  {
    group: "3-col: A B C",
    layout: ["A B C"],
    scenarios: [
      { name: "A -> B", action: { do: "swap", source: "a", target: "b" }, expected: [["b", "a", "c"]] },
      { name: "A -> C", action: { do: "swap", source: "a", target: "c" }, expected: [["c", "b", "a"]] },
      { name: "B -> C", action: { do: "swap", source: "b", target: "c" }, expected: [["a", "c", "b"]] },
    ],
  },

  {
    group: "3-col: A A B",
    layout: ["A A B"],
    scenarios: [
      { name: "A -> B", action: { do: "swap", source: "a", target: "b" }, expected: [["b", "a", "a"]] },
    ],
  },

  {
    group: "3-col: A B B",
    layout: ["A B B"],
    scenarios: [
      { name: "A -> B", action: { do: "swap", source: "a", target: "b" }, expected: [["b", "b", "a"]] },
    ],
  },

  {
    group: "3-col: A A A / B",
    layout: ["A A A", "B"],
    scenarios: [
      { name: "B ->| <A (auto-resize left)", action: { do: "autoResize", source: "b", target: "a", side: "left" }, expected: [["b", "a", "a"]] },
      { name: "A -> B (swap)", action: { do: "swap", source: "a", target: "b" }, expected: [["b"], ["a", "a", "a"]] },
      { name: "B ->| A> (auto-resize right)", action: { do: "autoResize", source: "b", target: "a", side: "right" }, expected: [["a", "a", "b"]] },
    ],
  },

  {
    group: "3-col: A A A / B B",
    layout: ["A A A", "B B"],
    scenarios: [
      { name: "A -> B (swap)", action: { do: "swap", source: "a", target: "b" }, expected: [["b", "b"], ["a", "a", "a"]] },
      { name: "B ->| A> (auto-resize right)", action: { do: "autoResize", source: "b", target: "a", side: "right" }, expected: [["a", "b", "b"]] },
      { name: "B ->| <A (auto-resize left)", action: { do: "autoResize", source: "b", target: "a", side: "left" }, expected: [["b", "b", "a"]] },
    ],
  },

  {
    group: "3-col: A A B / C",
    layout: ["A A B", "C"],
    scenarios: [
      { name: "A -> C", action: { do: "swap", source: "a", target: "c" }, expected: [["c", "b"], ["a", "a"]] },
      { name: "B -> C", action: { do: "swap", source: "b", target: "c" }, expected: [["a", "a", "c"], ["b"]] },
    ],
  },

  {
    group: "3-col: A A / B B",
    layout: ["A A", "B B"],
    maxColumns: 3,
    scenarios: [
      { name: "A -> B (swap)", action: { do: "swap", source: "a", target: "b" }, expected: [["b", "b"], ["a", "a"]] },
      { name: "B ->| A> (auto-resize right)", action: { do: "autoResize", source: "b", target: "a", side: "right" }, expected: [["a", "b", "b"]] },
    ],
  },

  {
    group: "3-col: A B C / D",
    layout: ["A B C", "D"],
    scenarios: [
      { name: "A -> D", action: { do: "swap", source: "a", target: "d" }, expected: [["d", "b", "c"], ["a"]] },
      { name: "C -> D", action: { do: "swap", source: "c", target: "d" }, expected: [["a", "b", "d"], ["c"]] },
    ],
  },

  {
    group: "3-col: A B C / D E",
    layout: ["A B C", "D E"],
    scenarios: [
      { name: "A -> D", action: { do: "swap", source: "a", target: "d" }, expected: [["d", "b", "c"], ["a", "e"]] },
      { name: "E -> B", action: { do: "swap", source: "e", target: "b" }, expected: [["a", "e", "c"], ["d", "b"]] },
    ],
  },

  {
    group: "3-col: A B C / D E F",
    layout: ["A B C", "D E F"],
    scenarios: [
      { name: "A -> F", action: { do: "swap", source: "a", target: "f" }, expected: [["f", "b", "c"], ["d", "e", "a"]] },
      { name: "A -> D", action: { do: "swap", source: "a", target: "d" }, expected: [["d", "b", "c"], ["a", "e", "f"]] },
      // multi-step
      {
        name: "A -> F then B -> E",
        steps: [
          { action: { do: "swap", source: "a", target: "f" } },
          { action: { do: "swap", source: "b", target: "e" }, expected: [["f", "e", "c"], ["d", "b", "a"]] },
        ],
      },
    ],
  },

  {
    group: "3-col: A A A / B C",
    layout: ["A A A", "B C"],
    scenarios: [
      { name: "A -> B (swap)", action: { do: "swap", source: "a", target: "b" }, expected: [["b"], ["a", "a", "a"], ["c"]] },
      { name: "B -> C", action: { do: "swap", source: "b", target: "c" }, expected: [["a", "a", "a"], ["c", "b"]] },
      { name: "B ->| <A (auto-resize left)", action: { do: "autoResize", source: "b", target: "a", side: "left" }, expected: [["b", "a", "a"], ["c"]] },
      { name: "C ->| A> (auto-resize right)", action: { do: "autoResize", source: "c", target: "a", side: "right" }, expected: [["a", "a", "c"], ["b"]] },
    ],
  },

  {
    group: "3-col: A A B / C C",
    layout: ["A A B", "C C"],
    scenarios: [
      { name: "A -> B", action: { do: "swap", source: "a", target: "b" }, expected: [["b", "a", "a"], ["c", "c"]] },
      { name: "C -> A", action: { do: "swap", source: "c", target: "a" }, expected: [["c", "c", "b"], ["a", "a"]] },
    ],
  },

  {
    group: "3-col: A A A / B B C",
    layout: ["A A A", "B B C"],
    scenarios: [
      { name: "A -> B (swap)", action: { do: "swap", source: "a", target: "b" }, expected: [["b", "b"], ["a", "a", "a"], ["c"]] },
      { name: "B -> C", action: { do: "swap", source: "b", target: "c" }, expected: [["a", "a", "a"], ["c", "b", "b"]] },
      { name: "C ->| A> (auto-resize right)", action: { do: "autoResize", source: "c", target: "a", side: "right" }, expected: [["a", "a", "c"], ["b", "b"]] },
    ],
  },

  {
    group: "3-col: A B C / x D",
    layout: ["A B C", "x D"],
    scenarios: [
      { name: "D -> <D (drag left into empty)", action: { do: "dragToEmpty", source: "d", direction: "left" }, expected: [["a", "b", "c"], ["d"]] },
      { name: "D -> D> (drag right into empty)", action: { do: "dragToEmpty", source: "d", direction: "right" }, expected: [["a", "b", "c"], [null, null, "d"]] },
    ],
  },

  {
    group: "3-col: A B C / D x x",
    layout: ["A B C", "D x x"],
    scenarios: [
      { name: "D -> x1 (drag right into adjacent empty)", action: { do: "dragToEmpty", source: "d", direction: "right" }, expected: [["a", "b", "c"], [null, "d"]] },
      { name: "D -> x2 (drag right into far empty)", action: { do: "dragToColumn", source: "d", col: 2 }, expected: [["a", "b", "c"], [null, null, "d"]] },
    ],
  },

  {
    group: "3-col: A B C / x x D",
    layout: ["A B C", "x x D"],
    scenarios: [
      { name: "D -> B (swap with pinned widget)", action: { do: "swap", source: "d", target: "b" }, expected: [["a", "d", "c"], [null, null, "b"]] },
      { name: "D ->| <B (auto-resize with pinned widget)", action: { do: "autoResize", source: "d", target: "b", side: "left" }, expected: [["a", "d", "c"], [null, null, "b"]] },
      { name: "C -> B", action: { do: "swap", source: "c", target: "b" }, expected: [["a", "c", "b"], [null, null, "d"]] },
      { name: "A -> B", action: { do: "swap", source: "a", target: "b" }, expected: [["b", "a", "c"], [null, null, "d"]] },
      { name: "D -> D (self-drag)", action: { do: "swap", source: "d", target: "d" }, expected: [["a", "b", "c"], [null, null, "d"]] },
    ],
  },

  {
    group: "3-col: A A B / x C D",
    layout: ["A A B", "x C D"],
    scenarios: [
      { name: "C -> D (swap)", action: { do: "swap", source: "c", target: "d" }, expected: [["a", "a", "b"], [null, "d", "c"]] },
      { name: "C ->| D> (auto-resize right)", action: { do: "autoResize", source: "c", target: "d", side: "right" }, expected: [["a", "a", "b"], [null, "d", "c"]] },
    ],
  },

  {
    group: "3-col: A A B / C D",
    layout: ["A A B", "C D"],
    scenarios: [
      { name: "D ->| <A (auto-resize left)", action: { do: "autoResize", source: "d", target: "a", side: "left" }, expected: [["d", "a", "b"], ["c"]] },
    ],
  },

  {
    group: "3-col: A B B / C D",
    layout: ["A B B", "C D"],
    scenarios: [
      { name: "D ->| <B (short dwell)", action: { do: "autoResize", source: "d", target: "b", side: "left", dwellMs: 350 }, expected: [["a", "d"], ["c", "b", "b"]] },
    ],
  },

  {
    group: "3-col: A A B / C D x",
    layout: ["A A B", "C D x"],
    scenarios: [
      { name: "D -> x (drag right into empty)", action: { do: "dragToEmpty", source: "d", direction: "right" }, expected: [["a", "a", "b"], ["c", null, "d"]] },
    ],
  },

  {
    group: "3-col: A A B / C D E",
    layout: ["A A B", "C D E"],
    scenarios: [
      { name: "E ->| A> (auto-resize right)", action: { do: "autoResize", source: "e", target: "a", side: "right" }, expected: [["a", "e", "b"], ["c", "d"]] },
    ],
  },

  {
    group: "3-col: A B x / C D D / x x E",
    layout: ["A B x", "C D D", "x x E"],
    scenarios: [
      { name: "E -> empty col at row 0", action: { do: "dragToColumnAt", source: "e", col: 2, ref: "a" }, expected: [["a", "b", "e"], ["c", "d", "d"]] },
      { name: "E ->| B> (auto-resize right of B)", action: { do: "autoResize", source: "e", target: "b", side: "right" }, expected: [["a", "b", "e"], ["c", "d", "d"]] },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
//  Feature-specific groups
// ═══════════════════════════════════════════════════════════════════

const featureGroups: ScenarioGroup[] = [
  {
    group: "empty-row maximize on dwell",
    scenarios: [
      {
        name: "shrunk widget maximizes when held in empty row",
        layout: ["A B", "C"],
        action: { do: "dragToEmptyCell", source: "c", col: 0, dwellMs: 1000 },
        expected: [["a", "b"], ["c", "c"]],
      },
      {
        name: "short dwell keeps column-pin (no maximize)",
        layout: ["A B", "C"],
        action: { do: "dragToEmptyCell", source: "c", col: 0, dwellMs: 350 },
        expected: [["a", "b"], ["c"]],
      },
      {
        name: "already-max widget does not change on dwell",
        layout: ["A A", "B"],
        action: { do: "dragToEmptyCell", source: "a", col: 0, dwellMs: 1000 },
        expected: [["b"], ["a", "a"]],
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
//  Register all data-driven scenarios
// ═══════════════════════════════════════════════════════════════════

defineScenarios(twoColGroups);
defineScenarios(threeColGroups);
defineScenarios(featureGroups);

// ═══════════════════════════════════════════════════════════════════
//  Standalone tests (require custom logic beyond the scenario runner)
// ═══════════════════════════════════════════════════════════════════

test("A -> empty col 0 in A B C / x D (custom coords)", async ({ page }) => {
  await setupDashboard(page, ["A B C", "x D"]);

  const dWidget = widgetById(page, "d");
  const dBox = await dWidget.boundingBox();
  const grid = page.locator('[data-testid="dashboard-grid"]');
  const gridBox = await grid.boundingBox();
  const maxCols = Number(await grid.evaluate((el) => (el as HTMLElement).dataset.maxColumns));
  const gap = Number(await grid.evaluate((el) => (el as HTMLElement).dataset.gap));
  const colWidth = (gridBox!.width - gap * (maxCols - 1)) / maxCols;

  const targetX = gridBox!.x + colWidth / 2;
  const targetY = dBox!.y + dBox!.height / 2;

  await dragByIdToCoords(page, "a", targetX, targetY);
  await assertLayout(page, [["b", "c"], ["a", "d"]]);
});

test("D -> D small move within own space in A B C / x x D (custom coords)", async ({ page }) => {
  await setupDashboard(page, ["A B C", "x x D"]);
  const dBox = await widgetById(page, "d").boundingBox();
  await dragByIdToCoords(page, "d", dBox!.x + dBox!.width / 2 + 15, dBox!.y + dBox!.height / 2 + 10);
  await assertLayout(page, [["a", "b", "c"], [null, null, "d"]]);
});

test("D -> empty col (span-2 to empty) in A B x / C x x / x D D / x E (custom coords)", async ({ page }) => {
  await setupDashboard(page, ["A B x", "C x x", "x D D", "x E"]);

  const aBox = await widgetById(page, "a").boundingBox();
  const grid = page.locator('[data-testid="dashboard-grid"]');
  const gridBox = await grid.boundingBox();
  const maxCols = Number(await grid.evaluate((el) => (el as HTMLElement).dataset.maxColumns));
  const gap = Number(await grid.evaluate((el) => (el as HTMLElement).dataset.gap));
  const colWidth = (gridBox!.width - gap * (maxCols - 1)) / maxCols;

  const targetX = gridBox!.x + 2 * (colWidth + gap) + colWidth / 2;
  const targetY = aBox!.y + aBox!.height / 2;

  await dragByIdToCoords(page, "d", targetX, targetY);
  await assertLayout(page, [["a", "b", "d"], ["c", "e"]]);
});

test("C ->| A> with trackpad tremor near center in A A / B C / D", async ({ page }) => {
  await setupDashboard(page, ["A A", "B C", "D"]);

  const handle = widgetDragHandleById(page, "c");
  const target = widgetById(page, "a");

  await handle.scrollIntoViewIfNeeded();
  const handleBox = await handle.boundingBox();
  const targetBox = await target.boundingBox();
  if (!handleBox || !targetBox) throw new Error("Could not get bounding boxes");

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  const targetCenterX = targetBox.x + targetBox.width / 2;
  const endX = targetCenterX + 3;
  const endY = targetBox.y + targetBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();

  const steps = 30;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await page.mouse.move(
      startX + (endX - startX) * t,
      startY + (endY - startY) * t,
    );
  }

  for (let i = 0; i < 60; i++) {
    const tremX = Math.sin(i * 0.7) * 10;
    const tremY = Math.cos(i * 0.9) * 3;
    await page.mouse.move(endX + tremX, endY + tremY);
    await page.waitForTimeout(16);
  }

  const previewGrid = await capturePreviewGrid(page);

  await page.mouse.up();
  await page.waitForTimeout(350);

  expect(
    previewGrid,
    "Drop ghost must be visible during drag",
  ).not.toBeNull();

  const finalGrid = await getGridRepresentation(page);
  expect(
    finalGrid,
    `Preview during drag does not match layout after drop.\n` +
    `Preview: ${JSON.stringify(previewGrid)}\n` +
    `Final:   ${JSON.stringify(finalGrid)}`,
  ).toEqual(previewGrid);

  await assertLayout(page, [["a", "c"], ["b", "d"]]);
});
