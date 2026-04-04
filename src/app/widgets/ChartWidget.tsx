import { memo } from "react";

const data = [
  { label: "Mon", value: 65 },
  { label: "Tue", value: 45 },
  { label: "Wed", value: 85 },
  { label: "Thu", value: 55 },
  { label: "Fri", value: 70 },
  { label: "Sat", value: 40 },
  { label: "Sun", value: 90 },
];

const maxValue = Math.max(...data.map((d) => d.value));

export const ChartWidget = memo(function ChartWidget() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <span className="dash-label-emphasis">Weekly Activity</span>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 200 }}>
        {data.map((d) => (
          <div key={d.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%" }}>
            <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
              <div
                className="dash-chart-bar"
                style={{ height: `${(d.value / maxValue) * 100}%` }}
              />
            </div>
            <span className="dash-body-sm">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
