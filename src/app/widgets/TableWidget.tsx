import { memo } from "react";

const rows = [
  { name: "Alice Johnson", email: "alice@example.com", role: "Admin", status: "Active" },
  { name: "Bob Smith", email: "bob@example.com", role: "Editor", status: "Active" },
  { name: "Carol Davis", email: "carol@example.com", role: "Viewer", status: "Inactive" },
  { name: "Dan Wilson", email: "dan@example.com", role: "Editor", status: "Active" },
  { name: "Eve Brown", email: "eve@example.com", role: "Admin", status: "Active" },
  { name: "Frank Lee", email: "frank@example.com", role: "Viewer", status: "Pending" },
];

const roleVariant: Record<string, string> = {
  Admin: "dash-tag--info",
  Editor: "dash-tag--success",
  Viewer: "dash-tag--neutral",
};

const statusColor: Record<string, string> = {
  Active: "var(--dash-color-success)",
  Inactive: "#9ca3af",
  Pending: "var(--dash-color-warning)",
};

export const TableWidget = memo(function TableWidget() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <span className="dash-label-emphasis">Team Members</span>
      <table className="dash-table">
        <thead>
          <tr>
            {["Name", "Email", "Role", "Status"].map((h) => (
              <th key={h}>
                <span className="dash-label-sm">{h}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.email}>
              <td><span className="dash-body-sm">{row.name}</span></td>
              <td><span className="dash-body-sm">{row.email}</span></td>
              <td><span className={`dash-tag ${roleVariant[row.role] ?? "dash-tag--neutral"}`}>{row.role}</span></td>
              <td>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span className="dash-status-dot" style={{ background: statusColor[row.status] ?? "#9ca3af" }} />
                  <span className="dash-body-sm">{row.status}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
