import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock3, FileText, RefreshCw, Search, Wrench } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

type WorkLogItem = {
  id: number;
  action?: string;
  message?: string;
  progress_percent?: number | null;
  created_at?: string | null;
  job_code?: string;
  job_title?: string;
  assignment_id?: number | null;
};

function readItems(data: unknown): WorkLogItem[] {
  if (Array.isArray(data)) return data as WorkLogItem[];
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  for (const key of ["logs", "work_logs", "items", "data"]) {
    if (Array.isArray(obj[key])) return obj[key] as WorkLogItem[];
  }
  return [];
}

function pretty(value?: string) {
  return String(value ?? "UPDATE")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function WorkerWorkLog() {
  const navigate = useNavigate();
  const [items, setItems] = useState<WorkLogItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await api.get("/worker/work-log");
      setItems(readItems(response.data));
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ??
          "Unable to load your maintenance work log.",
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [
        item.action,
        item.message,
        item.job_code,
        item.job_title,
        item.progress_percent,
      ]
        .filter((x) => x != null)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [items, search]);

  return (
    <main style={{ minHeight: "100vh", background: "#f4efe5", color: "#16394d" }}>
      <header style={{ minHeight: 72, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 26px", background: "#103249", color: "#fff", borderBottom: "3px solid #d56a2d" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" onClick={() => navigate("/worker")} style={{ width: 38, height: 38, display: "grid", placeItems: "center", border: "1px solid rgba(255,255,255,.18)", borderRadius: 8, background: "rgba(255,255,255,.06)", color: "#fff", cursor: "pointer" }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <strong style={{ display: "block", fontFamily: "Georgia, serif", fontSize: 25 }}>Work Log</strong>
            <span style={{ display: "block", color: "#b8cad5", fontSize: 9, fontWeight: 900, letterSpacing: ".15em" }}>WORKER MAINTENANCE HISTORY</span>
          </div>
        </div>

        <button type="button" onClick={() => void load()} style={{ height: 40, display: "flex", alignItems: "center", gap: 7, padding: "0 12px", border: 0, borderRadius: 7, background: "rgba(255,255,255,.09)", color: "#fff", cursor: "pointer", fontWeight: 800 }}>
          <RefreshCw size={15} />
          Refresh
        </button>
      </header>

      <section style={{ maxWidth: 1250, margin: "0 auto", padding: "20px 24px 34px" }}>
        <div style={{ marginBottom: 14 }}>
          <span style={{ color: "#9b5d20", fontSize: 9, fontWeight: 900, letterSpacing: ".14em" }}>AUDIT TRAIL</span>
          <h1 style={{ margin: "4px 0 5px", fontFamily: "Georgia, serif", fontSize: 30 }}>My Maintenance Activity</h1>
          <p style={{ margin: 0, color: "#6d7d85", fontSize: 12 }}>Every assignment, progress update, pause and completion is recorded here.</p>
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: 10, border: "1px solid #eac0b2", borderRadius: 7, background: "#fff0ea", color: "#99452e", fontSize: 11, fontWeight: 700 }}>
            {error}
          </div>
        )}

        <article style={{ border: "1px solid #dfd2c1", borderRadius: 10, background: "#fffdf9", overflow: "hidden" }}>
          <div style={{ minHeight: 62, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "0 15px", borderBottom: "1px solid #e6dbcf" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <FileText size={18} />
              <div>
                <span style={{ display: "block", color: "#9b5d20", fontSize: 8, fontWeight: 900 }}>WORK LOG</span>
                <strong style={{ display: "block", marginTop: 2 }}>{items.length} recorded events</strong>
              </div>
            </div>

            <label style={{ height: 36, display: "flex", alignItems: "center", gap: 6, padding: "0 10px", border: "1px solid #dcccc0", borderRadius: 6, background: "#fff" }}>
              <Search size={14} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search logs..." style={{ width: 190, border: 0, outline: 0 }} />
            </label>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#71818a" }}>Loading work history...</div>
          ) : visible.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#71818a" }}>No work-log entries available.</div>
          ) : (
            <div style={{ display: "grid", gap: 0 }}>
              {visible.map((item) => (
                <div key={item.id} style={{ display: "grid", gridTemplateColumns: "52px minmax(0,1fr) 150px", gap: 12, alignItems: "center", padding: "13px 15px", borderTop: "1px solid #eee5d9" }}>
                  <div style={{ width: 38, height: 38, display: "grid", placeItems: "center", borderRadius: 99, background: "#edf2f3" }}>
                    <Wrench size={16} />
                  </div>

                  <div>
                    <strong style={{ display: "block", fontSize: 12 }}>
                      {pretty(item.action)}
                      {item.job_code ? ` · ${item.job_code}` : ""}
                    </strong>
                    <span style={{ display: "block", marginTop: 4, color: "#6e7e86", fontSize: 10 }}>
                      {item.message ?? item.job_title ?? "RailSync worker activity"}
                    </span>
                    {item.progress_percent != null && (
                      <span style={{ display: "inline-block", marginTop: 5, padding: "3px 6px", borderRadius: 4, background: "#edf5ef", color: "#316b46", fontSize: 8, fontWeight: 900 }}>
                        Progress {item.progress_percent}%
                      </span>
                    )}
                  </div>

                  <div style={{ color: "#71818a", fontSize: 10 }}>
                    <Clock3 size={12} style={{ marginRight: 5, verticalAlign: "middle" }} />
                    {formatDate(item.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
