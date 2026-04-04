import { memo } from "react";

const stats = [
  { label: "Users", value: "12,847", change: "+12.5%" },
  { label: "Revenue", value: "$48.2k", change: "+8.2%" },
  { label: "Orders", value: "1,429", change: "-3.1%" },
  { label: "Growth", value: "24.5%", change: "+4.3%" },
];

export const StatsWidget = memo(function StatsWidget() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {stats.map((stat) => (
        <div key={stat.label} className="dash-stat-card">
          <div className="dash-label-sm">{stat.label}</div>
          <div className="dash-heading-md" style={{ marginTop: 4 }}>{stat.value}</div>
          <div
            className="dash-label-emphasis"
            style={{ marginTop: 4, color: stat.change.startsWith("+") ? "var(--dash-color-success)" : "var(--dash-color-danger)" }}
          >
            {stat.change}
          </div>
        </div>
      ))}
    </div>
  );
});
