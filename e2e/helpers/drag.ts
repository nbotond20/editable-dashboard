import type { Page } from "@playwright/test";
import { widgetDragHandle, widgetByLabel, allWidgetLabels } from "./locators";

export async function dragWidgetToWidget(
  page: Page,
  sourceLabel: string,
  targetLabel: string,
  options?: { steps?: number; dwellMs?: number }
) {
  const handle = widgetDragHandle(page, sourceLabel);
  const target = widgetByLabel(page, targetLabel);

  const handleBox = await handle.boundingBox();
  const targetBox = await target.boundingBox();
  if (!handleBox || !targetBox) throw new Error("Could not get bounding boxes");

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  const endX = targetBox.x + targetBox.width / 2;
  const endY = targetBox.y + targetBox.height / 2;

  await performDrag(page, startX, startY, endX, endY, options);
}

export async function dragWidgetToPosition(
  page: Page,
  sourceLabel: string,
  targetX: number,
  targetY: number,
  options?: { steps?: number; dwellMs?: number }
) {
  const handle = widgetDragHandle(page, sourceLabel);
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error("Could not get bounding box");

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;

  await performDrag(page, startX, startY, targetX, targetY, options);
}

async function performDrag(
  page: Page,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  options?: { steps?: number; dwellMs?: number }
) {
  const steps = options?.steps ?? 20;
  const dwellMs = options?.dwellMs ?? 500;

  await page.mouse.move(startX, startY);
  await page.mouse.down();

  for (let i = 1; i <= steps; i++) {
    const progress = i / steps;
    await page.mouse.move(
      startX + (endX - startX) * progress,
      startY + (endY - startY) * progress,
    );
  }

  // Dwell to allow zone resolution and intent computation
  await page.waitForTimeout(dwellMs);

  await page.mouse.up();

  // Wait for drop animation to complete
  await page.waitForTimeout(350);
}

export async function startDragWithoutDrop(
  page: Page,
  sourceLabel: string,
  deltaX: number,
  deltaY: number,
) {
  const handle = widgetDragHandle(page, sourceLabel);
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error("Could not get bounding box");

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();

  // Move past the 5px activation threshold
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    const progress = i / steps;
    await page.mouse.move(
      startX + deltaX * progress,
      startY + deltaY * progress,
    );
  }

  await page.waitForTimeout(100);
}

export async function getWidgetCenter(page: Page, label: string): Promise<{ x: number; y: number }> {
  const box = await widgetByLabel(page, label).boundingBox();
  if (!box) throw new Error(`Widget "${label}" not found`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export async function getGapBetweenWidgets(
  page: Page,
  label1: string,
  label2: string,
): Promise<{ x: number; y: number }> {
  const box1 = await widgetByLabel(page, label1).boundingBox();
  const box2 = await widgetByLabel(page, label2).boundingBox();
  if (!box1 || !box2) throw new Error("Could not get bounding boxes");

  const a = { right: box1.x + box1.width, bottom: box1.y + box1.height };
  const b = { left: box2.x, top: box2.y, bottom: box2.y + box2.height };

  // Same row: overlapping vertical extents
  const sameRow = box1.y < b.bottom && b.top < a.bottom;
  if (sameRow && b.left > a.right - 1) {
    // Horizontal gap midpoint
    return {
      x: (a.right + b.left) / 2,
      y: (Math.max(box1.y, b.top) + Math.min(a.bottom, b.bottom)) / 2,
    };
  }

  // Different rows: vertical gap between rows
  return {
    x: (box1.x + box1.width / 2 + box2.x + box2.width / 2) / 2,
    y: (a.bottom + b.top) / 2,
  };
}

export async function getEmptyAreaPosition(
  page: Page,
  columnIndex: number,
  maxColumns: number,
): Promise<{ x: number; y: number }> {
  // Find the grid container (the relatively positioned parent of widgets)
  const widgets = page.locator(".dash-widget");
  const count = await widgets.count();

  let lowestBottom = 0;
  let containerLeft = 0;
  let containerWidth = 0;

  for (let i = 0; i < count; i++) {
    const box = await widgets.nth(i).boundingBox();
    if (box) {
      if (i === 0) {
        // Approximate container from first widget's parent
        const parentBox = await widgets.nth(i).locator("..").boundingBox();
        if (parentBox) {
          containerLeft = parentBox.x;
          containerWidth = parentBox.width;
        }
      }
      const bottom = box.y + box.height;
      if (bottom > lowestBottom) lowestBottom = bottom;
    }
  }

  if (containerWidth === 0) throw new Error("Could not determine container dimensions");

  const colWidth = containerWidth / maxColumns;
  return {
    x: containerLeft + columnIndex * colWidth + colWidth / 2,
    y: lowestBottom + 40,
  };
}

export async function dragWidgetToGapBetween(
  page: Page,
  sourceLabel: string,
  beforeLabel: string,
  afterLabel: string,
) {
  const gapPos = await getGapBetweenWidgets(page, beforeLabel, afterLabel);
  await dragWidgetToPosition(page, sourceLabel, gapPos.x, gapPos.y, {
    dwellMs: 150,
    steps: 20,
  });
}

export async function performMultiZoneDrag(
  page: Page,
  sourceLabel: string,
  waypoints: Array<{ x: number; y: number; dwellMs: number }>,
) {
  const handle = widgetDragHandle(page, sourceLabel);
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error("Could not get bounding box");

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();

  // Move past activation threshold toward first waypoint
  const firstWp = waypoints[0];
  const activationSteps = 10;
  for (let i = 1; i <= activationSteps; i++) {
    const progress = i / activationSteps;
    await page.mouse.move(
      startX + (firstWp.x - startX) * progress,
      startY + (firstWp.y - startY) * progress,
    );
  }
  await page.waitForTimeout(firstWp.dwellMs);

  // Move through remaining waypoints
  for (let w = 1; w < waypoints.length; w++) {
    const wp = waypoints[w];
    const prev = waypoints[w - 1];
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const progress = i / steps;
      await page.mouse.move(
        prev.x + (wp.x - prev.x) * progress,
        prev.y + (wp.y - prev.y) * progress,
      );
    }
    await page.waitForTimeout(wp.dwellMs);
  }

  await page.mouse.up();
  await page.waitForTimeout(350);
}

export async function getGapBeforeWidget(
  page: Page,
  label: string,
): Promise<{ x: number; y: number }> {
  const box = await widgetByLabel(page, label).boundingBox();
  if (!box) throw new Error(`Widget "${label}" not found`);
  // Position just left of the widget's inset boundary
  return { x: Math.max(box.x - 4, 2), y: box.y + box.height / 2 };
}

export async function getGapAfterWidget(
  page: Page,
  label: string,
): Promise<{ x: number; y: number }> {
  const box = await widgetByLabel(page, label).boundingBox();
  if (!box) throw new Error(`Widget "${label}" not found`);
  return { x: box.x + box.width + 4, y: box.y + box.height / 2 };
}

// ── Touch drag helpers (synthetic PointerEvents) ─────────────────

const TOUCH_POINTER_ID = 2;

/**
 * Dispatch a synthetic PointerEvent on the specified element.
 * Uses evaluate to dispatch in the browser context.
 */
async function dispatchPointerEvent(
  page: Page,
  type: string,
  x: number,
  y: number,
  target: "handle" | "document",
  sourceLabel?: string,
) {
  await page.evaluate(
    ({ type, x, y, target, sourceLabel, pointerId }) => {
      let el: Element | null;
      if (target === "handle" && sourceLabel) {
        // Find the drag handle via data attrs + label
        const slots = document.querySelectorAll("[data-widget-id]");
        for (const slot of slots) {
          const label = slot.querySelector(".dash-label-emphasis");
          if (label?.textContent === sourceLabel) {
            el = slot.querySelector(".dash-widget__drag-handle");
            break;
          }
        }
        if (!el) throw new Error(`Drag handle for "${sourceLabel}" not found`);
      } else {
        el = document;
      }

      const event = new PointerEvent(type, {
        pointerId,
        pointerType: "touch",
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true,
        isPrimary: true,
      });
      el!.dispatchEvent(event);
    },
    { type, x, y, target, sourceLabel, pointerId: TOUCH_POINTER_ID },
  );
}

/** Start a touch drag by dispatching pointerdown with pointerType "touch". */
export async function touchStartDrag(
  page: Page,
  sourceLabel: string,
): Promise<{ x: number; y: number }> {
  const handle = widgetDragHandle(page, sourceLabel);
  const box = await handle.boundingBox();
  if (!box) throw new Error(`Drag handle for "${sourceLabel}" not found`);

  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await dispatchPointerEvent(page, "pointerdown", x, y, "handle", sourceLabel);
  return { x, y };
}

/** Move a touch pointer (dispatches pointermove on document). */
export async function touchMove(page: Page, x: number, y: number) {
  await dispatchPointerEvent(page, "pointermove", x, y, "document");
}

/** End a touch drag (dispatches pointerup on document). */
export async function touchEnd(page: Page, x: number, y: number) {
  await dispatchPointerEvent(page, "pointerup", x, y, "document");
}

/** Cancel a touch drag (dispatches pointercancel on document). */
export async function touchCancel(page: Page, x: number, y: number) {
  await dispatchPointerEvent(page, "pointercancel", x, y, "document");
}

/**
 * Full touch drag from one widget to another.
 * 1. Touch down on source handle
 * 2. Wait for activation delay (200ms)
 * 3. Move gradually to target
 * 4. Dwell at target
 * 5. Touch up
 */
export async function touchDragToWidget(
  page: Page,
  sourceLabel: string,
  targetLabel: string,
  options?: { dwellMs?: number; steps?: number },
) {
  const dwellMs = options?.dwellMs ?? 500;
  const steps = options?.steps ?? 15;

  const start = await touchStartDrag(page, sourceLabel);

  // Wait for touch activation delay (200ms) + buffer
  await page.waitForTimeout(250);

  const targetBox = await widgetByLabel(page, targetLabel).boundingBox();
  if (!targetBox) throw new Error(`Widget "${targetLabel}" not found`);
  const endX = targetBox.x + targetBox.width / 2;
  const endY = targetBox.y + targetBox.height / 2;

  // Move in steps
  for (let i = 1; i <= steps; i++) {
    const progress = i / steps;
    await touchMove(
      page,
      start.x + (endX - start.x) * progress,
      start.y + (endY - start.y) * progress,
    );
  }

  await page.waitForTimeout(dwellMs);
  await touchEnd(page, endX, endY);
  await page.waitForTimeout(350);
}

/**
 * Start a touch, then move more than tolerance to cancel (scrolling intent).
 * Returns without completing the drag.
 */
export async function touchDragCancel(
  page: Page,
  sourceLabel: string,
  moveDistance: number,
) {
  const start = await touchStartDrag(page, sourceLabel);

  // Move more than TOUCH_MOVE_TOLERANCE (10px) BEFORE activation delay (200ms)
  const steps = 5;
  for (let i = 1; i <= steps; i++) {
    const progress = i / steps;
    await touchMove(page, start.x, start.y + moveDistance * progress);
  }

  // Wait a bit then release
  await page.waitForTimeout(50);
  await touchEnd(page, start.x, start.y + moveDistance);
  await page.waitForTimeout(100);
}
