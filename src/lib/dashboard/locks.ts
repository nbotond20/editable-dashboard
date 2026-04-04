import type { LockType, WidgetDefinition, DashboardState } from "./types.ts";

export function lockFieldName(lockType: LockType): "lockPosition" | "lockResize" | "lockRemove" {
  switch (lockType) {
    case "position": return "lockPosition";
    case "resize": return "lockResize";
    case "remove": return "lockRemove";
  }
}

export function isLockActive(
  id: string,
  lockType: LockType,
  state: DashboardState,
  definitions: WidgetDefinition[],
): boolean {
  const widget = state.widgets.find((w) => w.id === id);
  if (!widget) return false;
  const field = lockFieldName(lockType);
  if (widget[field] != null) return widget[field]!;
  const def = definitions.find((d) => d.type === widget.type);
  return def?.[field] === true;
}
