import { memo } from "react";

const today = new Date();
const year = today.getFullYear();
const month = today.getMonth();
const daysInMonth = new Date(year, month + 1, 0).getDate();
const firstDayOfWeek = new Date(year, month, 1).getDay();
const monthName = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });

const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const highlightedDays = [3, 7, 14, 21, 28];

export const CalendarWidget = memo(function CalendarWidget() {
  const cells: Array<{ day: number | null; isToday: boolean; hasEvent: boolean }> = [];

  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push({ day: null, isToday: false, hasEvent: false });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      isToday: d === today.getDate(),
      hasEvent: highlightedDays.includes(d),
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <span className="dash-label-emphasis">{monthName}</span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {dayNames.map((name) => (
          <div key={name} style={{ textAlign: "center", padding: 4 }}>
            <span className="dash-label-sm">{name}</span>
          </div>
        ))}
        {cells.map((cell, i) => (
          <div
            key={i}
            className={cell.isToday ? "dash-calendar-today" : cell.hasEvent ? "dash-calendar-event" : undefined}
            style={{ textAlign: "center", padding: 6, borderRadius: 6 }}
          >
            {cell.day != null && (
              <span className="dash-body-sm">{cell.day}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
