import { defineScenarios, type ScenarioGroup } from "./helpers/scenario-runner";

const groups: ScenarioGroup[] = [
  {
    group: "Touch: basic swaps",
    scenarios: [
      { name: "A -> B in A B / C", layout: ["A B", "C"], action: { do: "touchSwap", source: "a", target: "b" }, expected: [["b", "a"], ["c"]] },
      { name: "A -> B in A B", layout: ["A B"], action: { do: "touchSwap", source: "a", target: "b" }, expected: [["b", "a"]] },
      { name: "B -> C in A B / C", layout: ["A B", "C"], action: { do: "touchSwap", source: "b", target: "c" }, expected: [["a", "c"], ["b"]] },
    ],
  },

  {
    group: "Touch: cross-row swaps",
    scenarios: [
      { name: "A -> C in A B / C", layout: ["A B", "C"], action: { do: "touchSwap", source: "a", target: "c" }, expected: [["c", "b"], ["a"]] },
      { name: "A -> C in A B / C D", layout: ["A B", "C D"], action: { do: "touchSwap", source: "a", target: "c" }, expected: [["c", "b"], ["a", "d"]] },
      { name: "A -> D in A B / C D", layout: ["A B", "C D"], action: { do: "touchSwap", source: "a", target: "d" }, expected: [["d", "b"], ["c", "a"]] },
    ],
  },

  {
    group: "Touch: multi-span swaps",
    scenarios: [
      { name: "A -> B in A A / B (wide swap)", layout: ["A A", "B"], action: { do: "touchSwap", source: "a", target: "b" }, expected: [["b"], ["a", "a"]] },
      { name: "A -> B in A A / B B (same-span)", layout: ["A A", "B B"], action: { do: "touchSwap", source: "a", target: "b" }, expected: [["b", "b"], ["a", "a"]] },
      { name: "A -> B in A A / B C (wide-narrow)", layout: ["A A", "B C"], action: { do: "touchSwap", source: "a", target: "b" }, expected: [["b"], ["a", "a"], ["c"]] },
    ],
  },

  {
    group: "Touch: auto-resize",
    scenarios: [
      { name: "B ->| A> in A A / B (resize right)", layout: ["A A", "B"], action: { do: "touchResize", source: "b", target: "a", side: "right" }, expected: [["a", "b"]] },
      { name: "B ->| <A in A A / B (resize left)", layout: ["A A", "B"], action: { do: "touchResize", source: "b", target: "a", side: "left" }, expected: [["b", "a"]] },
      { name: "B ->| A> in A A / B B (resize right)", layout: ["A A", "B B"], action: { do: "touchResize", source: "b", target: "a", side: "right" }, expected: [["a", "b"]] },
    ],
  },

  {
    group: "Touch: multi-step",
    scenarios: [
      {
        name: "D -> A then B -> C in A B / C D",
        layout: ["A B", "C D"],
        steps: [
          { action: { do: "touchSwap", source: "d", target: "a" } },
          { action: { do: "touchSwap", source: "b", target: "c" }, expected: [["d", "c"], ["b", "a"]] },
        ],
      },
    ],
  },

  {
    group: "Touch: cancel",
    scenarios: [
      {
        name: "fast move before activation preserves layout",
        layout: ["A B", "C"],
        action: { do: "touchCancel", source: "a", distance: 30 },
        expected: [["a", "b"], ["c"]],
      },
    ],
  },
];

defineScenarios(groups);
