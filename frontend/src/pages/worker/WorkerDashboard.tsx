import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Cog,
  Construction,
  Hammer,
  HardHat,
  History,
  Home,
  ListChecks,
  LogOut,
  Map as MapIcon,
  MapPin,
  MessageSquare,
  Pause,
  Pickaxe,
  Play,
  RadioTower,
  ShieldCheck,
  TimerReset,
  TrainFront,
  UserRound,
  Wrench,
  X,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import StraightTrackBlueprint from "../../components/railway/StraightTrackBlueprint";
import WorkerJobMap from "../../components/railway/WorkerJobMap";

import {
  completeWorkerJob,
  getWorkerAssignments,
  getWorkerProfile,
  getWorkerWorkLog,
  pauseWorkerJob,
  requestWorkerExtension,
  resumeWorkerJob,
  startWorkerJob,
  updateWorkerAvailability,
  type WorkerAssignment,
  type WorkerAvailability,
  type WorkerProfile,
  type WorkerWorkLog,
} from "../../services/workerApi";

import { useRailSyncRealtime } from "../../hooks/useRailSyncRealtime";
import "../../styles/workerDashboard.css";

function severityClass(severity?: string | null) {
  return severity?.toLowerCase().replaceAll("_", "-") || "medium";
}

function statusClass(status?: string | null) {
  return status?.toLowerCase().replaceAll("_", "-") || "not-started";
}

function prettyText(value?: string | null) {
  if (!value) return "—";
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function WorkerDashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [assignments, setAssignments] = useState<WorkerAssignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [workLogs, setWorkLogs] = useState<WorkerWorkLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [extensionMinutes, setExtensionMinutes] = useState(30);
  const [extensionReason, setExtensionReason] = useState("");
  const [extensionSending, setExtensionSending] = useState(false);

  const loadWorkerData = useCallback(async (preserveSelected = true) => {
    try {
      setError(null);
      const [profileData, assignmentsData, logsData] = await Promise.all([
        getWorkerProfile(),
        getWorkerAssignments(),
        getWorkerWorkLog(),
      ]);

      setProfile(profileData);
      setAssignments(assignmentsData.assignments);
      setWorkLogs(logsData.logs);

      if (assignmentsData.assignments.length === 0) {
        setSelectedAssignmentId(null);
      } else {
        setSelectedAssignmentId((current) => {
          if (
            preserveSelected &&
            current &&
            assignmentsData.assignments.some(
              (assignment) => assignment.assignment_id === current,
            )
          ) {
            return current;
          }

          const active = assignmentsData.assignments.find((assignment) =>
            ["IN_PROGRESS", "PAUSED", "ASSIGNED", "ACCEPTED"].includes(
              assignment.assignment_status,
            ),
          );

          return active?.assignment_id ?? assignmentsData.assignments[0].assignment_id;
        });
      }
    } catch (requestError) {
      console.error(requestError);
      setError("Unable to load Worker operations data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkerData(false);
  }, [loadWorkerData]);


  const handleRealtimeEvent = useCallback(
    (event: { type: string }) => {
      const refreshEvents = new Set([
        "JOB_ASSIGNED",
        "EXTENSION_APPROVED",
        "EXTENSION_REJECTED",
      ]);

      if (refreshEvents.has(event.type)) {
        void loadWorkerData();
      }
    },
    [loadWorkerData]
  );


  const {
    connected: realtimeConnected,
  } = useRailSyncRealtime({
    onEvent: handleRealtimeEvent,
  });

  const selectedAssignment = useMemo(() => {
    if (selectedAssignmentId === null) return assignments[0] ?? null;
    return (
      assignments.find(
        (assignment) => assignment.assignment_id === selectedAssignmentId,
      ) ?? assignments[0] ?? null
    );
  }, [assignments, selectedAssignmentId]);

  const activeAssignments = useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          assignment.assignment_status !== "COMPLETED" &&
          assignment.assignment_status !== "CANCELLED",
      ),
    [assignments],
  );


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

  async function changeAvailability(value: WorkerAvailability) {
    try {
      setActionLoading(true);
      await updateWorkerAvailability(value, "Updated from Worker dashboard");
      await loadWorkerData();
    } catch (requestError) {
      console.error(requestError);
      setError("Could not update availability.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStart() {
    if (!selectedAssignment) return;
    try {
      setActionLoading(true);
      if (selectedAssignment.assignment_status === "PAUSED") {
        await resumeWorkerJob(selectedAssignment.assignment_id);
      } else {
        await startWorkerJob(selectedAssignment.assignment_id);
      }
      await loadWorkerData();
    } catch (requestError) {
      console.error(requestError);
      setError("Unable to start/resume this job.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePause() {
    if (!selectedAssignment) return;
    try {
      setActionLoading(true);
      await pauseWorkerJob(selectedAssignment.assignment_id);
      await loadWorkerData();
    } catch (requestError) {
      console.error(requestError);
      setError("Unable to pause this job.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleComplete() {
    if (!selectedAssignment) return;
    const shouldComplete = window.confirm(
      `Complete ${selectedAssignment.job.job_code}?`,
    );
    if (!shouldComplete) return;

    try {
      setActionLoading(true);
      await completeWorkerJob(selectedAssignment.assignment_id);
      await loadWorkerData();
    } catch (requestError) {
      console.error(requestError);
      setError("Unable to complete this job.");
    } finally {
      setActionLoading(false);
    }
  }

  async function submitExtensionRequest() {
    if (!selectedAssignment || !extensionReason.trim()) return;

    try {
      setExtensionSending(true);
      await requestWorkerExtension(
        selectedAssignment.assignment_id,
        extensionMinutes,
        extensionReason.trim(),
      );
      setShowExtensionModal(false);
      setExtensionReason("");
      setExtensionMinutes(30);
      await loadWorkerData();
    } catch (requestError) {
      console.error(requestError);
      setError("Unable to send extension request.");
    } finally {
      setExtensionSending(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("railsync_access_token");
    localStorage.removeItem("railsync_user");
    localStorage.removeItem("railsync_refresh_token");
    window.location.href = "/";
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f4eee5",
          color: "#102c42",
          fontFamily: "Georgia, serif",
          fontSize: 24,
        }}
      >
        Loading RailSync Worker Operations…
      </div>
    );
  }

  return (
    <div className="worker-dashboard">
      <header className="worker-header">
        <div className="worker-brand">
          <div className="worker-brand-icon">
            <TrainFront size={25} />
          </div>
          <div className="worker-brand-copy">
            <strong>RailSync</strong>
            <span>INDIAN RAILWAYS</span>
          </div>
          <div className="worker-brand-motto">
            <span>RAILWAY ASSET</span>
            <span>COORDINATION SYSTEM</span>
          </div>
        </div>

        <div className="worker-header-right">
          <div className="worker-online">
            <RadioTower size={12} /> {realtimeConnected ? "Realtime Connected" : "Realtime Reconnecting…"}
          </div>
          <div className="worker-notification">
            <Bell size={18} />
            {activeAssignments.length > 0 && <span>{activeAssignments.length}</span>}
          </div>
          <div className="worker-ir">
            <div>IR</div>
            <span>
              <strong>Indian Railways</strong>
              <small>Field Operations</small>
            </span>
          </div>
          <div className="worker-profile">
            <div className="worker-avatar">
              <UserRound size={19} />
            </div>
            <span>
              <strong>{profile?.employee_code ?? "Worker"}</strong>
              <small>{profile?.designation ?? "Maintenance Worker"}</small>
            </span>
          </div>
        </div>
      </header>

      <aside className="worker-sidebar">
        <div className="worker-sidebar-heading">
          <span>FIELD OPERATIONS</span>
          <strong>Worker Control</strong>
        </div>

        <div className="worker-tool-art" aria-hidden="true">
          <Wrench className="sidebar-tool tool-a" />
          <Hammer className="sidebar-tool tool-b" />
          <Pickaxe className="sidebar-tool tool-c" />
          <Construction className="sidebar-tool tool-d" />
          <Cog className="sidebar-tool tool-e" />
          <Wrench className="sidebar-tool tool-f" />
          <Hammer className="sidebar-tool tool-g" />
          <Pickaxe className="sidebar-tool tool-h" />
          <Wrench className="sidebar-tool tool-i" />
          <Cog className="sidebar-tool tool-j" />
          <Hammer className="sidebar-tool tool-k" />
          <Construction className="sidebar-tool tool-l" />
        </div>

        <nav className="worker-navigation">
          <button
            className="active"
            type="button"
            onClick={() => navigate("/worker")}
          >
            <Home size={16} />
            <span>Dashboard</span>
            <ChevronRight size={13} />
          </button>

          <button
            type="button"
            onClick={() => navigate("/worker/tasks")}
          >
            <ListChecks size={16} />
            <span>My Tasks</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/worker/map")}
          >
            <MapIcon size={16} />
            <span>Live Map</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/worker/approvals")}
          >
            <ClipboardCheck size={16} />
            <span>Approvals</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/worker/work-log")}
          >
            <History size={16} />
            <span>Work Log</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/worker/safety")}
          >
            <ShieldCheck size={16} />
            <span>Safety & Guidelines</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/worker/messages")}
          >
            <MessageSquare size={16} />
            <span>Messages</span>
            {activeAssignments.length > 0 && <em>{activeAssignments.length}</em>}
          </button>

          <button
            type="button"
            onClick={() => navigate("/worker/resources")}
          >
            <BookOpen size={16} />
            <span>Resources</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/worker/help")}
          >
            <CircleHelp size={16} />
            <span>Help & Support</span>
          </button>
        </nav>

        <button className="worker-signout" type="button" onClick={handleLogout}>
          <LogOut size={15} /> Sign Out
        </button>
      </aside>

      <main className="worker-content">
        <section className="worker-intro">
          <span>MAINTENANCE CONTROL</span>
          <h1>Welcome, {profile?.employee_code ?? "Worker"}</h1>
          <p>
            {profile?.division ?? "Railway"} Division • {profile?.railway_zone ?? "Indian Railways"}
          </p>
          <div className="worker-tricolor"><i /><i /><i /></div>
        </section>

        {error && (
          <div style={{ margin: "10px 14px 0", padding: "10px 14px", borderRadius: 8, background: "#fee7e4", color: "#9b3029", fontSize: 12 }}>
            <AlertTriangle size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
            {error}
          </div>
        )}


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

        <StraightTrackBlueprint
          startStation={selectedAssignment?.job.segment?.from_station_name ?? "Station A"}
          endStation={selectedAssignment?.job.segment?.to_station_name ?? "Station B"}
          blockId={selectedAssignment?.job.segment?.segment_code ?? "NO ACTIVE BLOCK"}
          maintenanceId={selectedAssignment?.job.job_code ?? "NO ASSIGNMENT"}
          priority={(selectedAssignment?.job.severity ?? "LOW") as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"}
        />

        <section className="worker-summary-grid">
          <article>
            <div className="worker-summary-icon orange"><MapPin size={17} /></div>
            <div>
              <span>JOB LOCATION</span>
              <h3>{selectedAssignment?.job.segment?.name ?? "No active job"}</h3>
              <small>KM {selectedAssignment?.job.km_marker ?? "—"}</small>
            </div>
          </article>

          <article>
            <div className="worker-summary-icon green"><ShieldCheck size={17} /></div>
            <div>
              <span>AUTHORITY</span>
              <h3>{selectedAssignment?.job.required_authority ?? "—"}</h3>
              <small>{selectedAssignment?.job.required_skill ?? "No assignment"}</small>
            </div>
          </article>

          <article>
            <div className="worker-summary-icon soft-green"><Clock3 size={17} /></div>
            <div>
              <span>PLANNED TIME</span>
              <h3>{selectedAssignment?.job.estimated_minutes ?? 0} min</h3>
              <small>{formatTime(selectedAssignment?.job.planned_start)} – {formatTime(selectedAssignment?.job.planned_end)}</small>
            </div>
          </article>

          <article>
            <div>
              <span>PROGRESS</span>
              <h3 className="orange-text">{selectedAssignment?.progress_percent ?? 0}%</h3>
              <div className="worker-small-bar">
                <i style={{ width: `${selectedAssignment?.progress_percent ?? 0}%` }} />
              </div>
            </div>
          </article>

          <article className="worker-status-card">
            <div className="worker-status-title">
              <strong>My Status</strong>
              <span><i />{prettyText(profile?.availability)}</span>
            </div>
            <div>
              <span>Assignment</span>
              <strong>{prettyText(selectedAssignment?.assignment_status)}</strong>
            </div>
            <div>
              <span>Availability</span>
              <select
                disabled={actionLoading}
                value={profile?.availability ?? "AVAILABLE"}
                onChange={(event) => {
                  void changeAvailability(
                    event.target.value as WorkerAvailability
                  );
                }}
              >
                <option value="AVAILABLE">Available</option>
                <option value="PARTIAL">Partial</option>
                <option value="UNAVAILABLE">Unavailable</option>
              </select>
            </div>
          </article>
        </section>

        <section className="worker-panel worker-jobs">
          <div className="worker-panel-heading">
            <div>
              <HardHat size={20} />
              <span>
                <small>ASSIGNED BY MANAGER</small>
                <h2>Jobs Need to Be Done</h2>
              </span>
            </div>
            <span className="worker-pending-count">{activeAssignments.length} active</span>
          </div>

          {activeAssignments.length === 0 ? (
            <div style={{ padding: "24px 10px", textAlign: "center", color: "#72818a", fontSize: 12 }}>
              No maintenance jobs are currently assigned to you.
            </div>
          ) : (
            <div className="worker-jobs-grid">
              {activeAssignments.map((assignment) => (
                <article
                  key={assignment.assignment_id}
                  className={`worker-job-card ${severityClass(assignment.job.severity)}`}
                  onClick={() => setSelectedAssignmentId(assignment.assignment_id)}
                  style={{
                    cursor: "pointer",
                    outline: selectedAssignment?.assignment_id === assignment.assignment_id
                      ? "2px solid rgba(211,91,35,.35)"
                      : "none",
                  }}
                >
                  <div className="worker-job-top">
                    <span><i />{assignment.job.severity}</span>
                    <small>{assignment.job.job_code}</small>
                  </div>
                  <h3>{assignment.job.title}</h3>
                  <p>{prettyText(assignment.job.asset_type)}</p>
                  <div className="worker-job-detail"><MapPin size={11} />{assignment.job.segment?.name ?? "Railway section"}</div>
                  <div className="worker-job-detail"><Clock3 size={11} />{assignment.job.estimated_minutes} minutes</div>
                  <footer>
                    <span>{prettyText(assignment.assignment_status)}</span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedAssignmentId(assignment.assignment_id);
                      }}
                    >
                      View Job <ArrowRight size={10} />
                    </button>
                  </footer>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="worker-middle-grid">
          <div className="worker-panel">
            <div className="worker-panel-heading">
              <div>
                <MapIcon size={20} />
                <span><small>JOB SITE</small><h2>Maintenance Location</h2></span>
              </div>
              <span className="worker-pending-count">{selectedAssignment?.job.job_code ?? "No Job"}</span>
            </div>

            <WorkerJobMap
              latitude={selectedAssignment?.job.latitude ?? undefined}
              longitude={selectedAssignment?.job.longitude ?? undefined}
              jobTitle={selectedAssignment?.job.title ?? "No assigned maintenance job"}
              jobCode={selectedAssignment?.job.job_code ?? "—"}
              severity={selectedAssignment?.job.severity ?? "LOW"}
              fromStation={selectedAssignment?.job.segment?.from_station_name ?? undefined}
              toStation={selectedAssignment?.job.segment?.to_station_name ?? undefined}
            />
          </div>

          <div className="worker-panel">
            <div className="worker-panel-heading compact">
              <div>
                <Wrench size={18} />
                <span><small>CONTROL</small><h2>Quick Actions</h2></span>
              </div>
            </div>

            <div className="worker-actions">
              <button
                className="start"
                type="button"
                disabled={
                  !selectedAssignment ||
                  actionLoading ||
                  selectedAssignment.assignment_status === "IN_PROGRESS" ||
                  selectedAssignment.assignment_status === "COMPLETED"
                }
                onClick={() => void handleStart()}
              >
                <Play size={14} />
                {selectedAssignment?.assignment_status === "PAUSED" ? "Resume Work" : "Start Work"}
              </button>

              <button
                className="pause"
                type="button"
                disabled={!selectedAssignment || actionLoading || selectedAssignment.assignment_status !== "IN_PROGRESS"}
                onClick={() => void handlePause()}
              >
                <Pause size={14} /> Pause
              </button>

              <button
                className="complete"
                type="button"
                disabled={
                  !selectedAssignment ||
                  actionLoading ||
                  !["IN_PROGRESS", "PAUSED"].includes(selectedAssignment.assignment_status)
                }
                onClick={() => void handleComplete()}
              >
                <CheckCircle2 size={14} /> Complete
              </button>

              <button
                className="request"
                type="button"
                disabled={
                  !selectedAssignment ||
                  !["IN_PROGRESS", "PAUSED"].includes(selectedAssignment.assignment_status)
                }
                onClick={() => setShowExtensionModal(true)}
              >
                <TimerReset size={14} /> Request More Time
              </button>
            </div>

            <div className="worker-current-status">
              <strong>Current Job</strong>
              <span>{prettyText(selectedAssignment?.assignment_status)}</span>
            </div>

            {selectedAssignment && (
              <div style={{ marginTop: 12, fontSize: 10, lineHeight: 1.6, color: "#64747d" }}>
                <strong>{selectedAssignment.job.job_code}</strong><br />
                {selectedAssignment.job.priority_reason ?? "No additional priority note."}
              </div>
            )}
          </div>
        </section>

        <section className="worker-lower-grid">
          <div className="worker-panel">
            <div className="worker-panel-heading compact">
              <div>
                <ListChecks size={18} />
                <span><small>TODAY</small><h2>Assigned Tasks</h2></span>
              </div>
              <button
                className="worker-link"
                type="button"
                onClick={() => navigate("/worker/tasks")}
              >
                {assignments.length} total <ChevronRight size={10} />
              </button>
            </div>

            <div className="worker-task-table">
              <div className="worker-task-row heading">
                <span>#</span><span>Task</span><span>Section</span><span>Status</span><span>Time</span>
              </div>

              {assignments.map((assignment, index) => (
                <div
                  className="worker-task-row"
                  key={assignment.assignment_id}
                  onClick={() => setSelectedAssignmentId(assignment.assignment_id)}
                  style={{ cursor: "pointer" }}
                >
                  <span>{index + 1}</span>
                  <strong>{assignment.job.title}</strong>
                  <span>{assignment.job.segment?.name ?? "—"}</span>
                  <span className={`worker-task-status ${statusClass(assignment.assignment_status)}`}>
                    <i />{prettyText(assignment.assignment_status)}
                  </span>
                  <span>{formatTime(assignment.job.planned_start)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="worker-panel">
            <div className="worker-panel-heading compact">
              <div>
                <History size={18} />
                <span><small>ACTIVITY</small><h2>Recent Work Log</h2></span>
              </div>
            </div>

            <div className="worker-log">
              {workLogs.slice(0, 6).map((log) => (
                <div key={log.id}>
                  <i />
                  <time>{formatTime(log.created_at)}</time>
                  <span>
                    <p>{prettyText(log.action)}</p>
                    <small>{log.message ?? "Worker activity"}</small>
                  </span>
                </div>
              ))}

              {workLogs.length === 0 && (
                <div style={{ display: "block", color: "#78848b", fontSize: 10 }}>
                  No work log entries yet.
                </div>
              )}
            </div>
          </div>
        </section>

        <footer className="worker-footer">
          <div><TrainFront size={19} /><strong>RailSync</strong></div>
          <span>Railway maintenance coordination • authenticated worker session</span>
          <div><i />PostgreSQL Connected</div>
        </footer>
      </main>

      {showExtensionModal && (
        <div className="worker-extension-backdrop">
          <div className="worker-extension-modal">
            <button
              className="extension-close"
              type="button"
              onClick={() => setShowExtensionModal(false)}
            >
              <X size={17} />
            </button>

            <div className="extension-icon"><TimerReset size={23} /></div>
            <span>MANAGER APPROVAL REQUIRED</span>
            <h3>Request More Time</h3>

            <label>Additional time</label>
            <select
              value={extensionMinutes}
              onChange={(event) => setExtensionMinutes(Number(event.target.value))}
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
              <option value={90}>90 minutes</option>
              <option value={120}>120 minutes</option>
            </select>

            <label>Reason</label>
            <textarea
              rows={4}
              placeholder="Explain why additional maintenance time is required..."
              value={extensionReason}
              onChange={(event) => setExtensionReason(event.target.value)}
            />

            <button
              className="extension-submit"
              type="button"
              disabled={extensionSending || extensionReason.trim().length < 3}
              onClick={() => void submitExtensionRequest()}
            >
              <TimerReset size={15} />
              {extensionSending ? "Sending…" : "Send to Manager"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
