import { defineScenarios, type ScenarioGroup } from "./helpers/scenario-runner";

// ═══════════════════════════════════════════════════════════════════
//  Ghost preview tests
//
//  Each scenario asserts the ghost preview grid (mid-drag, before
//  committing) matches the expected layout. The `preview` field is
//  verified against the grid captured while the pointer is held on
//  the target, before the mouse is released.
// ═══════════════════════════════════════════════════════════════════

const swapPreview: ScenarioGroup[] = [
  {
    group: "preview: same-row swap (3-col)",
    layout: ["A B C"],
    maxColumns: 3,
    scenarios: [
      { name: "A -> B", action: { do: "swap", source: "a", target: "b" }, preview: [["b", "a", "c"]], expected: [["b", "a", "c"]] },
      { name: "B -> C", action: { do: "swap", source: "b", target: "c" }, preview: [["a", "c", "b"]], expected: [["a", "c", "b"]] },
      { name: "A -> C", action: { do: "swap", source: "a", target: "c" }, preview: [["c", "b", "a"]], expected: [["c", "b", "a"]] },
    ],
  },

  {
    group: "preview: same-row swap (2-col)",
    layout: ["A B"],
    scenarios: [
      { name: "A -> B", action: { do: "swap", source: "a", target: "b" }, preview: [["b", "a"]], expected: [["b", "a"]] },
      { name: "B -> A", action: { do: "swap", source: "b", target: "a" }, preview: [["b", "a"]], expected: [["b", "a"]] },
    ],
  },

  {
    group: "preview: cross-row swap (2-col)",
    layout: ["A B", "C D"],
    scenarios: [
      { name: "A -> D", action: { do: "swap", source: "a", target: "d" }, preview: [["d", "b"], ["c", "a"]], expected: [["d", "b"], ["c", "a"]] },
      { name: "B -> C", action: { do: "swap", source: "b", target: "c" }, preview: [["a", "c"], ["b", "d"]], expected: [["a", "c"], ["b", "d"]] },
      { name: "A -> C", action: { do: "swap", source: "a", target: "c" }, preview: [["c", "b"], ["a", "d"]], expected: [["c", "b"], ["a", "d"]] },
    ],
  },
];

const multiSpanSwapPreview: ScenarioGroup[] = [
  {
    group: "preview: multi-span swap (2-col)",
    layout: ["A A", "B"],
    scenarios: [
      { name: "A -> B (swap)", action: { do: "swap", source: "a", target: "b" }, preview: [["b"], ["a", "a"]], expected: [["b"], ["a", "a"]] },
    ],
  },

  {
    group: "preview: multi-span swap (2-col, 4 widgets)",
    layout: ["A A", "B C"],
    scenarios: [
      { name: "A -> C (swap)", action: { do: "swap", source: "a", target: "c" }, preview: [["c", "b"], ["a", "a"]], expected: [["c", "b"], ["a", "a"]] },
      { name: "B -> C (swap)", action: { do: "swap", source: "b", target: "c" }, preview: [["a", "a"], ["c", "b"]], expected: [["a", "a"], ["c", "b"]] },
    ],
  },

  {
    group: "preview: multi-span swap (3-col)",
    layout: ["A A B"],
    maxColumns: 3,
    scenarios: [
      { name: "A -> B (swap)", action: { do: "swap", source: "a", target: "b" }, preview: [["b", "a", "a"]], expected: [["b", "a", "a"]] },
      { name: "B -> A (swap)", action: { do: "swap", source: "b", target: "a" }, preview: [["b", "a", "a"]], expected: [["b", "a", "a"]] },
    ],
  },
];

const autoResizePreview: ScenarioGroup[] = [
  {
    group: "preview: auto-resize (2-col, A A / B)",
    layout: ["A A", "B"],
    scenarios: [
      { name: "B ->| A> (right)", action: { do: "autoResize", source: "b", target: "a", side: "right" }, preview: [["a", "b"]], expected: [["a", "b"]] },
      { name: "B ->| <A (left)", action: { do: "autoResize", source: "b", target: "a", side: "left" }, preview: [["b", "a"]], expected: [["b", "a"]] },
    ],
  },

  {
    group: "preview: auto-resize (2-col, A A / B C)",
    layout: ["A A", "B C"],
    scenarios: [
      { name: "C ->| <A (left)", action: { do: "autoResize", source: "c", target: "a", side: "left" }, preview: [["c", "a"], ["b"]], expected: [["c", "a"], ["b"]] },
      { name: "C ->| A> (right)", action: { do: "autoResize", source: "c", target: "a", side: "right" }, preview: [["a", "c"], ["b"]], expected: [["a", "c"], ["b"]] },
    ],
  },

  {
    group: "preview: auto-resize asymmetric spans (3-col, A A A / B)",
    layout: ["A A A", "B"],
    maxColumns: 3,
    scenarios: [
      { name: "B ->| <A (left)", action: { do: "autoResize", source: "b", target: "a", side: "left" }, preview: [["b", "a", "a"]], expected: [["b", "a", "a"]] },
      { name: "B ->| A> (right)", action: { do: "autoResize", source: "b", target: "a", side: "right" }, preview: [["a", "a", "b"]], expected: [["a", "a", "b"]] },
    ],
  },

  {
    group: "preview: auto-resize asymmetric spans (3-col, A A A / B C)",
    layout: ["A A A", "B C"],
    maxColumns: 3,
    scenarios: [
      { name: "B ->| <A (left)", action: { do: "autoResize", source: "b", target: "a", side: "left" }, preview: [["b", "a", "a"], ["c"]], expected: [["b", "a", "a"], ["c"]] },
      { name: "C ->| A> (right)", action: { do: "autoResize", source: "c", target: "a", side: "right" }, preview: [["a", "a", "c"], ["b"]], expected: [["a", "a", "c"], ["b"]] },
    ],
  },

  {
    group: "preview: auto-resize short dwell falls back to swap",
    layout: ["A B", "C D"],
    scenarios: [
      { name: "C ->| <A (short dwell)", action: { do: "autoResize", source: "c", target: "a", side: "left", dwellMs: 350 }, preview: [["c", "b"], ["a", "d"]], expected: [["c", "b"], ["a", "d"]] },
      { name: "C ->| A> (short dwell)", action: { do: "autoResize", source: "c", target: "a", side: "right", dwellMs: 350 }, preview: [["c", "b"], ["a", "d"]], expected: [["c", "b"], ["a", "d"]] },
    ],
  },
];

const positionalPreview: ScenarioGroup[] = [
  {
    group: "preview: drag to empty (3-col, A B C / x D)",
    layout: ["A B C", "x D"],
    maxColumns: 3,
    scenarios: [
      { name: "D -> left (drag into empty)", action: { do: "dragToEmpty", source: "d", direction: "left" }, preview: [["a", "b", "c"], ["d"]], expected: [["a", "b", "c"], ["d"]] },
      { name: "D -> right (drag into empty)", action: { do: "dragToEmpty", source: "d", direction: "right" }, preview: [["a", "b", "c"], [null, null, "d"]], expected: [["a", "b", "c"], [null, null, "d"]] },
    ],
  },

  {
    group: "preview: drag to column (3-col, A B C / D x x)",
    layout: ["A B C", "D x x"],
    maxColumns: 3,
    scenarios: [
      { name: "D -> col 1", action: { do: "dragToColumn", source: "d", col: 1 }, preview: [["a", "b", "c"], [null, "d"]], expected: [["a", "b", "c"], [null, "d"]] },
      { name: "D -> col 2", action: { do: "dragToColumn", source: "d", col: 2 }, preview: [["a", "b", "c"], [null, null, "d"]], expected: [["a", "b", "c"], [null, null, "d"]] },
    ],
  },

  {
    group: "preview: drag to column at widget (3-col)",
    layout: ["A B x", "C D D", "x x E"],
    maxColumns: 3,
    scenarios: [
      { name: "E -> col 2 at row 0", action: { do: "dragToColumnAt", source: "e", col: 2, ref: "a" }, preview: [["a", "b", "e"], ["c", "d", "d"]], expected: [["a", "b", "e"], ["c", "d", "d"]] },
    ],
  },
];

const emptyRowMaximizePreview: ScenarioGroup[] = [
  {
    group: "preview: empty-row maximize on dwell",
    scenarios: [
      {
        name: "long dwell maximizes widget in preview",
        layout: ["A B", "C"],
        action: { do: "dragToEmptyCell", source: "c", col: 0, dwellMs: 1000 },
        preview: [["a", "b"], ["c", "c"]],
        expected: [["a", "b"], ["c", "c"]],
      },
      {
        name: "short dwell keeps column-pin in preview",
        layout: ["A B", "C"],
        action: { do: "dragToEmptyCell", source: "c", col: 0, dwellMs: 350 },
        preview: [["a", "b"], ["c"]],
        expected: [["a", "b"], ["c"]],
      },
    ],
  },
];

const multiStepPreview: ScenarioGroup[] = [
  {
    group: "preview: multi-step correctness",
    layout: ["A B", "C D"],
    scenarios: [
      {
        name: "preview correct after prior swap (D -> A then B -> C)",
        steps: [
          { action: { do: "swap", source: "d", target: "a" } },
          { action: { do: "swap", source: "b", target: "c" }, preview: [["d", "c"], ["b", "a"]], expected: [["d", "c"], ["b", "a"]] },
        ],
      },
      {
        name: "preview on every step",
        steps: [
          { action: { do: "swap", source: "a", target: "b" }, preview: [["b", "a"], ["c", "d"]], expected: [["b", "a"], ["c", "d"]] },
          { action: { do: "swap", source: "c", target: "d" }, preview: [["b", "a"], ["d", "c"]], expected: [["b", "a"], ["d", "c"]] },
        ],
      },
    ],
  },

  {
    group: "preview: auto-resize after swap-and-back",
    layout: ["A A", "B C"],
    scenarios: [
      {
        name: "C ->| A> after B<->C swap-and-back",
        steps: [
          { action: { do: "swap", source: "b", target: "c" } },
          { action: { do: "swap", source: "b", target: "c" } },
          { action: { do: "autoResize", source: "c", target: "a", side: "right" }, preview: [["a", "c"], ["b"]], expected: [["a", "c"], ["b"]] },
        ],
      },
    ],
  },
];

defineScenarios([
  ...swapPreview,
  ...multiSpanSwapPreview,
  ...autoResizePreview,
  ...positionalPreview,
  ...emptyRowMaximizePreview,
  ...multiStepPreview,
]);
