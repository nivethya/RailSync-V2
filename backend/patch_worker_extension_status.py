from pathlib import Path

ROOT = Path(__file__).resolve().parent
FILE = ROOT.parent / "frontend" / "src" / "pages" / "worker" / "WorkerDashboard.tsx"

if not FILE.exists():
    raise SystemExit(f"Missing {FILE}")

text = FILE.read_text(encoding="utf-8")
backup = FILE.with_suffix(".tsx.before_extension_status")
if not backup.exists():
    backup.write_text(text, encoding="utf-8")

anchor = '''  const activeAssignments = useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          assignment.assignment_status !== "COMPLETED" &&
          assignment.assignment_status !== "CANCELLED",
      ),
    [assignments],
  );
'''

addition = anchor + '''

  const latestExtensionDecision = useMemo(
    () =>
      workLogs.find(
        (log) =>
          ["EXTENSION_APPROVED", "EXTENSION_REJECTED"].includes(
            String(log.action ?? "").trim().toUpperCase(),
          ),
      ) ?? null,
    [workLogs],
  );
'''

if "latestExtensionDecision" not in text:
    if anchor not in text:
        raise SystemExit("Could not find activeAssignments block.")
    text = text.replace(anchor, addition, 1)

error_block = '''        {error && (
          <div style={{ margin: "10px 14px 0", padding: "10px 14px", borderRadius: 8, background: "#fee7e4", color: "#9b3029", fontSize: 12 }}>
            <AlertTriangle size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
            {error}
          </div>
        )}
'''

banner = error_block + '''

        {latestExtensionDecision && (
          <div
            style={{
              margin: "10px 14px 0",
              padding: "11px 14px",
              borderRadius: 8,
              border:
                String(latestExtensionDecision.action ?? "").toUpperCase() === "EXTENSION_APPROVED"
                  ? "1px solid #afd4bb"
                  : "1px solid #e4b8b2",
              background:
                String(latestExtensionDecision.action ?? "").toUpperCase() === "EXTENSION_APPROVED"
                  ? "#eaf6ee"
                  : "#fff0ed",
              color:
                String(latestExtensionDecision.action ?? "").toUpperCase() === "EXTENSION_APPROVED"
                  ? "#286b45"
                  : "#9c4036",
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            <CheckCircle2 size={15} style={{ verticalAlign: "middle", marginRight: 7 }} />
            {String(latestExtensionDecision.action ?? "").toUpperCase() === "EXTENSION_APPROVED"
              ? "Extra-time request ACCEPTED by Manager"
              : "Extra-time request REJECTED by Manager"}
            <span style={{ display: "block", marginTop: 4, fontWeight: 600 }}>
              {latestExtensionDecision.message ?? "Manager decision received."}
            </span>
          </div>
        )}
'''

if "Extra-time request ACCEPTED by Manager" not in text:
    if error_block not in text:
        raise SystemExit("Could not find WorkerDashboard error block.")
    text = text.replace(error_block, banner, 1)

FILE.write_text(text, encoding="utf-8")
print("SUCCESS")
print("WorkerDashboard extension decision banner added.")
print("Backup:", backup)