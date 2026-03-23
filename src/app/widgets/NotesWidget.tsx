const notes = [
  "Review Q4 metrics dashboard before Thursday standup",
  "Update API documentation for v2 endpoints",
  "Schedule design review for new onboarding flow",
  "Prepare demo for stakeholder presentation",
];

export function NotesWidget() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <span className="dash-label-emphasis">Quick Notes</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {notes.map((note, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div className="dash-note-bullet" />
            <span className="dash-body-sm">{note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
