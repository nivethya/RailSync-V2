import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, RefreshCw, ShieldCheck, Wrench } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

type Assignment = {
  id: number;
  status?: string;
  progress_percent?: number;
  job?: {
    job_code?: string;
    title?: string;
    severity?: string;
    status?: string;
  } | null;
  maintenance_job?: {
    job_code?: string;
    title?: string;
    severity?: string;
    status?: string;
  } | null;
};

function norm(value?: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function readAssignments(data: unknown): Assignment[] {
  if (Array.isArray(data)) return data as Assignment[];
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  for (const key of ["assignments", "items", "data"]) {
    if (Array.isArray(obj[key])) return obj[key] as Assignment[];
  }
  return [];
}

function jobOf(item: Assignment) {
  return item.job ?? item.maintenance_job ?? null;
}

export default function WorkerApprovals() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await api.get("/worker/assignments");
      setAssignments(readAssignments(response.data));
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Unable to load approval status.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 12000);
    return () => window.clearInterval(timer);
  }, [load]);

  const cards = useMemo(() => {
    return assignments
      .filter((item) =>
        ["ASSIGNED", "IN_PROGRESS", "PAUSED", "EXTENSION_REQUESTED", "COMPLETED"].includes(
          norm(item.status),
        ),
      )
      .map((item) => {
        const job = jobOf(item);
        const status = norm(item.status);

        let label = "Authorized";
        let detail = "Maintenance Control has assigned and authorized this work.";
        let tone = "approved";

        if (status === "EXTENSION_REQUESTED") {
          label = "Awaiting Manager";
          detail = "Your extension request is waiting for Maintenance Manager approval.";
          tone = "waiting";
        } else if (status === "COMPLETED") {
          label = "Completed";
          detail = "Work completion has been recorded in the RailSync audit trail.";
          tone = "approved";
        } else if (status === "PAUSED") {
          label = "Paused";
          detail = "Work is paused. Resume when field conditions allow.";
          tone = "waiting";
        }

        return { item, job, label, detail, tone };
      });
  }, [assignments]);

  return (
    <main style={{ minHeight: "100vh", background: "#f4efe5", color: "#16394d" }}>
      <header style={{ minHeight: 72, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 26px", background: "#103249", color: "#fff", borderBottom: "3px solid #d56a2d" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" onClick={() => navigate("/worker")} style={{ width: 38, height: 38, display: "grid", placeItems: "center", border: "1px solid rgba(255,255,255,.18)", borderRadius: 8, background: "rgba(255,255,255,.06)", color: "#fff", cursor: "pointer" }}>
            <ArrowLeft size={18} />
          </button>

          <div>
            <strong style={{ display: "block", fontFamily: "Georgia, serif", fontSize: 25 }}>Approvals</strong>
            <span style={{ display: "block", color: "#b8cad5", fontSize: 9, fontWeight: 900, letterSpacing: ".15em" }}>MANAGER AUTHORIZATION & EXTENSION STATUS</span>
          </div>
        </div>

        <button type="button" onClick={() => void load()} style={{ height: 40, display: "flex", alignItems: "center", gap: 7, padding: "0 12px", border: 0, borderRadius: 7, background: "rgba(255,255,255,.09)", color: "#fff", cursor: "pointer", fontWeight: 800 }}>
          <RefreshCw size={15} />
          Refresh
        </button>
      </header>

      <section style={{ maxWidth: 1250, margin: "0 auto", padding: "20px 24px 34px" }}>
        <span style={{ color: "#9b5d20", fontSize: 9, fontWeight: 900, letterSpacing: ".14em" }}>WORK AUTHORIZATION</span>
        <h1 style={{ margin: "4px 0 5px", fontFamily: "Georgia, serif", fontSize: 30 }}>Manager Approval Status</h1>
        <p style={{ margin: "0 0 15px", color: "#6d7d85", fontSize: 12 }}>
          Track assignments authorized by Maintenance Control and extension requests awaiting a manager decision.
        </p>

        {error && (
          <div style={{ marginBottom: 12, padding: 10, border: "1px solid #eac0b2", borderRadius: 7, background: "#fff0ea", color: "#99452e", fontSize: 11, fontWeight: 700 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#71818a" }}>Loading approvals...</div>
        ) : cards.length === 0 ? (
          <div style={{ padding: 40, border: "1px solid #dfd2c1", borderRadius: 10, background: "#fffdf9", textAlign: "center", color: "#71818a" }}>
            No approval activity yet.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {cards.map(({ item, job, label, detail, tone }) => (
              <article key={item.id} style={{ display: "grid", gridTemplateColumns: "54px minmax(0,1fr) 180px", gap: 12, alignItems: "center", padding: 14, border: "1px solid #dfd2c1", borderRadius: 9, background: "#fffdf9" }}>
                <div style={{ width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: 99, background: tone === "approved" ? "#e8f2eb" : "#fff1d9", color: tone === "approved" ? "#2c6d49" : "#9b641d" }}>
                  {tone === "approved" ? <ShieldCheck size={18} /> : <Clock3 size={18} />}
                </div>

                <div>
                  <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
                    <strong>{job?.job_code ?? `ASSIGNMENT-${item.id}`}</strong>
                    <span style={{ padding: "3px 6px", borderRadius: 4, background: tone === "approved" ? "#e8f2eb" : "#fff1d9", color: tone === "approved" ? "#2c6d49" : "#9b641d", fontSize: 8, fontWeight: 900 }}>
                      {label}
                    </span>
                  </div>

                  <span style={{ display: "block", marginTop: 4, color: "#526a77", fontSize: 12, fontWeight: 700 }}>
                    {job?.title ?? "Railway maintenance assignment"}
                  </span>

                  <span style={{ display: "block", marginTop: 4, color: "#71818a", fontSize: 10 }}>
                    {detail}
                  </span>
                </div>

                <button type="button" onClick={() => navigate("/worker/tasks")} style={{ height: 37, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: 0, borderRadius: 6, background: "#164862", color: "#fff", cursor: "pointer", fontWeight: 900, fontSize: 10 }}>
                  <Wrench size={14} />
                  Open Task
                </button>
              </article>
            ))}
          </div>
        )}

        <div style={{ marginTop: 14, padding: 11, borderRadius: 7, background: "#edf3f5", color: "#496774", fontSize: 10 }}>
          <CheckCircle2 size={14} style={{ marginRight: 5, verticalAlign: "middle" }} />
          Approval status updates automatically from the shared RailSync backend.
        </div>
      </section>
    </main>
  );
}
