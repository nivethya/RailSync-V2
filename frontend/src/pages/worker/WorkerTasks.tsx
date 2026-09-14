import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CheckCircle2,
  Clock3,
  MapPinned,
  Pause,
  Play,
  RefreshCw,
  Search,
  Wrench,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import api from "../../services/api";

type Assignment = {
  id?: number;
  assignment_id?: number;
  status?: string;
  assignment_status?: string;
  progress_percent?: number;
  suitability_score?: number | null;
  assigned_at?: string | null;
  accepted_at?: string | null;
  started_at?: string | null;
  paused_at?: string | null;
  completed_at?: string | null;

  job?: {
    id?: number;
    job_code?: string;
    title?: string;
    description?: string;
    severity?: string;
    status?: string;
    required_skill?: string;
    required_authority?: string;
    estimated_minutes?: number;
    priority_score?: number;
    km_marker?: number;
    latitude?: number | string | null;
    longitude?: number | string | null;

    corridor?: {
      name?: string;
    } | null;

    segment?: {
      name?: string;
    } | null;
  } | null;

  maintenance_job?: {
    id?: number;
    job_code?: string;
    title?: string;
    description?: string;
    severity?: string;
    status?: string;
    required_skill?: string;
    required_authority?: string;
    estimated_minutes?: number;
    priority_score?: number;
    km_marker?: number;
    latitude?: number | string | null;
    longitude?: number | string | null;

    corridor?: {
      name?: string;
    } | null;

    segment?: {
      name?: string;
    } | null;
  } | null;
};

function norm(value?: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function formatStatus(value?: string) {
  return String(value ?? "UNKNOWN")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getAssignments(data: unknown): Assignment[] {
  if (Array.isArray(data)) {
    return data as Assignment[];
  }

  if (!data || typeof data !== "object") {
    return [];
  }

  const obj = data as Record<string, unknown>;

  for (const key of [
    "assignments",
    "items",
    "data",
  ]) {
    if (Array.isArray(obj[key])) {
      return obj[key] as Assignment[];
    }
  }

  return [];
}

function assignmentJob(assignment: Assignment) {
  return assignment.job ?? assignment.maintenance_job ?? null;
}

function assignmentId(assignment: Assignment) {
  return Number(assignment.assignment_id ?? assignment.id);
}

function assignmentStatus(assignment: Assignment) {
  return norm(assignment.assignment_status ?? assignment.status);
}

function severityColor(severity?: string) {
  switch (norm(severity)) {
    case "CRITICAL":
      return {
        bg: "#fee0da",
        text: "#b33429",
      };

    case "HIGH":
      return {
        bg: "#ffead7",
        text: "#9a581c",
      };

    case "MEDIUM":
      return {
        bg: "#fff4cf",
        text: "#876716",
      };

    default:
      return {
        bg: "#e9f2ed",
        text: "#316d4d",
      };
  }
}

export default function WorkerTasks() {
  const navigate = useNavigate();

  const [
    assignments,
    setAssignments,
  ] = useState<Assignment[]>([]);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    actionId,
    setActionId,
  ] = useState<number | null>(null);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("ALL");

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const loadAssignments =
    useCallback(
      async (
        silent = false,
      ) => {
        if (!silent) {
          setIsLoading(true);
        }

        setError("");

        try {
          const response =
            await api.get(
              "/worker/assignments",
            );

          setAssignments(
            getAssignments(
              response.data,
            ),
          );
        } catch (err: any) {
          setError(
            err?.response
              ?.data
              ?.detail
            ??
            "Unable to load your assigned maintenance work.",
          );
        } finally {
          if (!silent) {
            setIsLoading(false);
          }
        }
      },
      [],
    );


  useEffect(() => {
    void loadAssignments();

    const interval =
      window.setInterval(
        () => {
          void loadAssignments(
            true,
          );
        },
        12000,
      );

    return () =>
      window.clearInterval(
        interval,
      );
  }, [loadAssignments]);


  const visibleAssignments =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return assignments
        .filter(
          (assignment) => {
            const job =
              assignmentJob(
                assignment,
              );

            if (
              statusFilter
              !== "ALL"
              &&
              assignmentStatus(
                assignment,
              )
              !== statusFilter
            ) {
              return false;
            }

            if (!query) {
              return true;
            }

            const haystack =
              [
                job?.job_code,
                job?.title,
                job?.description,
                job?.severity,
                job?.corridor?.name,
                job?.segment?.name,
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return haystack.includes(
              query,
            );
          },
        )
        .sort(
          (a, b) => {
            const priority =
              (assignmentJob(b)
                ?.priority_score
              ?? 0)
              -
              (assignmentJob(a)
                ?.priority_score
              ?? 0);

            return priority;
          },
        );
    }, [
      assignments,
      search,
      statusFilter,
    ]);


  const summary =
    useMemo(() => ({
      total:
        assignments.length,

      assigned:
        assignments.filter(
          (item) =>
            [
              "ASSIGNED",
              "ACCEPTED",
            ].includes(
              assignmentStatus(
                item,
              ),
            ),
        ).length,

      active:
        assignments.filter(
          (item) =>
            [
              "IN_PROGRESS",
              "PAUSED",
            ].includes(
              assignmentStatus(
                item,
              ),
            ),
        ).length,

      completed:
        assignments.filter(
          (item) =>
            assignmentStatus(
              item,
            )
            === "COMPLETED",
        ).length,
    }), [
      assignments,
    ]);


  async function executeAction(
    assignment:
      Assignment,

    action:
      "start"
      | "pause"
      | "resume"
      | "complete",
  ) {
    const resolvedId =
      assignmentId(
        assignment,
      );

    if (!Number.isFinite(resolvedId)) {
      setError("Assignment ID is missing.");
      return;
    }

    setActionId(
      resolvedId,
    );

    setMessage("");
    setError("");

    try {
      await api.post(
        `/worker/assignments/${resolvedId}/${action}`,
      );

      setMessage(
        action
          === "start"
          ? "Maintenance work started."
          : action
          === "pause"
            ? "Work paused."
            : action
            === "resume"
              ? "Work resumed."
              : "Maintenance work completed.",
      );

      await loadAssignments(
        true,
      );
    } catch (err: any) {
      setError(
        err?.response
          ?.data
          ?.detail
        ??
        `Unable to ${action} this assignment.`,
      );
    } finally {
      setActionId(
        null,
      );
    }
  }


  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f4efe5",
        color: "#16394d",
      }}
    >
      <header
        style={{
          minHeight: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          background: "#103249",
          color: "#fff",
          borderBottom: "3px solid #d56a2d",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              display: "grid",
              placeItems: "center",
              border: "1px solid rgba(255,255,255,.22)",
              borderRadius: 8,
            }}
          >
            <Wrench size={21} />
          </div>

          <div>
            <strong
              style={{
                display: "block",
                fontFamily: "Georgia, serif",
                fontSize: 26,
              }}
            >
              RailSync
            </strong>

            <span
              style={{
                display: "block",
                color: "#b8cad5",
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: ".16em",
              }}
            >
              MAINTENANCE WORKER · MY TASKS
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadAssignments()
          }
          style={{
            height: 40,
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "0 12px",
            border: 0,
            borderRadius: 7,
            background: "rgba(255,255,255,.1)",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 800,
          }}
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </header>

      <section
        style={{
          maxWidth: 1450,
          margin: "0 auto",
          padding: "20px 24px 34px",
        }}
      >
        <div
          style={{
            marginBottom: 16,
          }}
        >
          <span
            style={{
              color: "#9b5d20",
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: ".16em",
            }}
          >
            ASSIGNED MAINTENANCE
          </span>

          <h1
            style={{
              margin: "4px 0 5px",
              fontFamily: "Georgia, serif",
              fontSize: 31,
            }}
          >
            My Tasks
          </h1>

          <p
            style={{
              margin: 0,
              color: "#687b85",
              fontSize: 12,
            }}
          >
            Jobs assigned by Maintenance Control appear here automatically.
          </p>
        </div>

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0,1fr))",
            gap: 11,
            marginBottom: 14,
          }}
        >
          {[
            ["ASSIGNED TODAY", summary.total],
            ["WAITING TO START", summary.assigned],
            ["ACTIVE WORK", summary.active],
            ["COMPLETED", summary.completed],
          ].map(
            ([label, value]) => (
              <article
                key={String(label)}
                style={{
                  minHeight: 74,
                  padding: "13px 15px",
                  border: "1px solid #dfd2c1",
                  borderRadius: 9,
                  background: "#fffdf9",
                }}
              >
                <span
                  style={{
                    display: "block",
                    color: "#788890",
                    fontSize: 9,
                    fontWeight: 900,
                    letterSpacing: ".12em",
                  }}
                >
                  {label}
                </span>

                <strong
                  style={{
                    display: "block",
                    marginTop: 4,
                    fontFamily: "Georgia, serif",
                    fontSize: 27,
                  }}
                >
                  {value}
                </strong>
              </article>
            ),
          )}
        </section>

        {(error || message) && (
          <div
            style={{
              marginBottom: 12,
              padding: "10px 12px",
              borderRadius: 7,
              border:
                error
                  ? "1px solid #eac0b2"
                  : "1px solid #bdd9c6",
              background:
                error
                  ? "#fff0ea"
                  : "#edf6ef",
              color:
                error
                  ? "#9c442c"
                  : "#316b46",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {error || message}
          </div>
        )}

        <section
          style={{
            border: "1px solid #dfd2c1",
            borderRadius: 10,
            background: "#fffdf9",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              padding: 14,
              borderBottom: "1px solid #e7dccf",
            }}
          >
            <div>
              <span
                style={{
                  color: "#9b5d20",
                  fontSize: 9,
                  fontWeight: 900,
                  letterSpacing: ".14em",
                }}
              >
                LIVE ASSIGNMENT QUEUE
              </span>

              <h2
                style={{
                  margin: "2px 0 0",
                  fontFamily: "Georgia, serif",
                  fontSize: 21,
                }}
              >
                Assigned Work
              </h2>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <label
                style={{
                  height: 36,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "0 9px",
                  border: "1px solid #dcccc0",
                  borderRadius: 6,
                  background: "#fff",
                }}
              >
                <Search size={14} />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value,
                    )
                  }
                  placeholder="Search assigned jobs..."
                  style={{
                    width: 190,
                    border: 0,
                    outline: 0,
                  }}
                />
              </label>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value,
                  )
                }
                style={{
                  height: 36,
                  padding: "0 8px",
                  border: "1px solid #dcccc0",
                  borderRadius: 6,
                  background: "#fff",
                }}
              >
                <option value="ALL">
                  All Status
                </option>

                <option value="ASSIGNED">
                  Assigned
                </option>

                <option value="IN_PROGRESS">
                  In Progress
                </option>

                <option value="PAUSED">
                  Paused
                </option>

                <option value="COMPLETED">
                  Completed
                </option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div
              style={{
                padding: 38,
                textAlign: "center",
                color: "#6d7d85",
              }}
            >
              Loading assigned maintenance work...
            </div>
          ) : visibleAssignments.length === 0 ? (
            <div
              style={{
                padding: 42,
                textAlign: "center",
                color: "#708089",
              }}
            >
              <CheckCircle2
                size={28}
                style={{
                  marginBottom: 9,
                }}
              />

              <div>
                No assignments match the current filter.
              </div>

              <div
                style={{
                  marginTop: 5,
                  fontSize: 11,
                }}
              >
                A job assigned by the Manager will appear here.
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 10,
                padding: 13,
              }}
            >
              {visibleAssignments.map(
                (assignment) => {
                  const job =
                    assignmentJob(
                      assignment,
                    );

                  const severity =
                    severityColor(
                      job?.severity,
                    );

                  const status =
                    assignmentStatus(
                      assignment,
                    );

                  const resolvedId =
                    assignmentId(
                      assignment,
                    );

                  const progress =
                    Number(
                      assignment.progress_percent
                      ?? 0,
                    );

                  return (
                    <article
                      key={resolvedId}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "minmax(0,1.5fr) minmax(210px,.7fr) 255px",
                        gap: 14,
                        alignItems: "center",
                        padding: 15,
                        border:
                          job?.severity
                          === "CRITICAL"
                            ? "1px solid #e6b8aa"
                            : "1px solid #e5dbcf",
                        borderLeft:
                          job?.severity
                          === "CRITICAL"
                            ? "4px solid #c54435"
                            : "4px solid #d49743",
                        borderRadius: 8,
                        background: "#fff",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: "flex",
                            gap: 7,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              padding: "4px 7px",
                              borderRadius: 4,
                              background:
                                severity.bg,
                              color:
                                severity.text,
                              fontSize: 8,
                              fontWeight: 900,
                            }}
                          >
                            {job?.severity ?? "—"}
                          </span>

                          <span
                            style={{
                              color: "#9b5d20",
                              fontSize: 10,
                              fontWeight: 900,
                              letterSpacing: ".06em",
                            }}
                          >
                            {job?.job_code ?? `ASSIGNMENT-${resolvedId}`}
                          </span>

                          <span
                            style={{
                              padding: "4px 7px",
                              borderRadius: 4,
                              background: "#eaf0f2",
                              color: "#4b6877",
                              fontSize: 8,
                              fontWeight: 800,
                            }}
                          >
                            {formatStatus(
                              assignment.assignment_status
                              ?? assignment.status,
                            )}
                          </span>
                        </div>

                        <h3
                          style={{
                            margin: "7px 0 5px",
                            fontFamily: "Georgia, serif",
                            fontSize: 21,
                          }}
                        >
                          {job?.title ?? "Maintenance Assignment"}
                        </h3>

                        <p
                          style={{
                            margin: 0,
                            color: "#6a7a82",
                            fontSize: 11,
                            lineHeight: 1.5,
                          }}
                        >
                          {job?.description ??
                            "Assigned railway maintenance task."}
                        </p>

                        <div
                          style={{
                            display: "flex",
                            gap: 14,
                            flexWrap: "wrap",
                            marginTop: 9,
                            color: "#536d79",
                            fontSize: 10,
                          }}
                        >
                          <span>
                            <MapPinned
                              size={12}
                              style={{
                                marginRight: 4,
                                verticalAlign: "middle",
                              }}
                            />
                            {job?.corridor?.name ?? "Railway corridor"}
                          </span>

                          <span>
                            KM {job?.km_marker ?? "—"}
                          </span>

                          <span>
                            <Clock3
                              size={12}
                              style={{
                                marginRight: 4,
                                verticalAlign: "middle",
                              }}
                            />
                            {job?.estimated_minutes ?? "—"} min
                          </span>
                        </div>
                      </div>

                      <div>
                        <span
                          style={{
                            display: "block",
                            color: "#78868e",
                            fontSize: 8,
                            fontWeight: 900,
                            letterSpacing: ".1em",
                          }}
                        >
                          WORK PROGRESS
                        </span>

                        <strong
                          style={{
                            display: "block",
                            marginTop: 4,
                            fontSize: 21,
                          }}
                        >
                          {progress}%
                        </strong>

                        <div
                          style={{
                            height: 7,
                            marginTop: 6,
                            overflow: "hidden",
                            borderRadius: 99,
                            background: "#e4e8e7",
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(
                                  0,
                                  progress,
                                ),
                              )}%`,
                              height: "100%",
                              background: "#42795c",
                            }}
                          />
                        </div>

                        <span
                          style={{
                            display: "block",
                            marginTop: 9,
                            color: "#71818a",
                            fontSize: 9,
                          }}
                        >
                          AI worker match:{" "}
                          {assignment.suitability_score == null
                            ? "—"
                            : `${Math.round(
                                Number(
                                  assignment.suitability_score,
                                ) <= 1
                                  ? Number(
                                      assignment.suitability_score,
                                    ) * 100
                                  : Number(
                                      assignment.suitability_score,
                                    ),
                              )}%`}
                        </span>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "1fr 1fr",
                          gap: 7,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/worker/map?assignment=${resolvedId}`,
                            )
                          }
                          style={{
                            minHeight: 38,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 5,
                            border:
                              "1px solid #cbd7dc",
                            borderRadius: 6,
                            background: "#eef3f5",
                            color: "#244b60",
                            cursor: "pointer",
                            fontWeight: 800,
                            fontSize: 10,
                          }}
                        >
                          <MapPinned size={14} />
                          Location
                        </button>

                        {[
                          "ASSIGNED",
                          "ACCEPTED",
                        ].includes(status) && (
                          <button
                            type="button"
                            onClick={() =>
                              void executeAction(
                                assignment,
                                "start",
                              )
                            }
                            disabled={
                              actionId
                              === resolvedId
                            }
                            style={{
                              minHeight: 38,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 5,
                              border: 0,
                              borderRadius: 6,
                              background: "#2c7550",
                              color: "#fff",
                              cursor: "pointer",
                              fontWeight: 900,
                              fontSize: 10,
                            }}
                          >
                            <Play size={14} />
                            Start
                          </button>
                        )}

                        {status === "IN_PROGRESS" && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                void executeAction(
                                  assignment,
                                  "pause",
                                )
                              }
                              disabled={
                                actionId
                                === resolvedId
                              }
                              style={{
                                minHeight: 38,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 5,
                                border: 0,
                                borderRadius: 6,
                                background: "#b07a2b",
                                color: "#fff",
                                cursor: "pointer",
                                fontWeight: 900,
                                fontSize: 10,
                              }}
                            >
                              <Pause size={14} />
                              Pause
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void executeAction(
                                  assignment,
                                  "complete",
                                )
                              }
                              disabled={
                                actionId
                                === resolvedId
                              }
                              style={{
                                minHeight: 38,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 5,
                                border: 0,
                                borderRadius: 6,
                                background: "#174f69",
                                color: "#fff",
                                cursor: "pointer",
                                fontWeight: 900,
                                fontSize: 10,
                              }}
                            >
                              <CheckCircle2 size={14} />
                              Complete
                            </button>
                          </>
                        )}

                        {status === "PAUSED" && (
                          <button
                            type="button"
                            onClick={() =>
                              void executeAction(
                                assignment,
                                "resume",
                              )
                            }
                            disabled={
                              actionId
                              === resolvedId
                            }
                            style={{
                              minHeight: 38,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 5,
                              border: 0,
                              borderRadius: 6,
                              background: "#2c7550",
                              color: "#fff",
                              cursor: "pointer",
                              fontWeight: 900,
                              fontSize: 10,
                            }}
                          >
                            <Play size={14} />
                            Resume
                          </button>
                        )}

                        {status === "COMPLETED" && (
                          <div
                            style={{
                              gridColumn: "1 / -1",
                              minHeight: 38,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 5,
                              borderRadius: 6,
                              background: "#e9f3ec",
                              color: "#2a6b46",
                              fontSize: 10,
                              fontWeight: 900,
                            }}
                          >
                            <CheckCircle2 size={14} />
                            Completed
                          </div>
                        )}
                      </div>
                    </article>
                  );
                },
              )}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
