import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  Filter,
  MapPinned,
  RefreshCw,
  Search,
  ShieldAlert,
  UserRoundCheck,
  Users,
  Wrench,
  X,
} from "lucide-react";

import api from "../../services/api";
import ManagerSmartMap from "./ManagerSmartMap";
import "../../styles/managerDashboard.css";


type Corridor = {
  id: number;
  corridor_code?: string;
  name?: string;
  railway_zone?: string;
  zone?: string;
  division?: string;
  start_station_name?: string;
  end_station_name?: string;
};

type Segment = {
  id?: number;
  segment_code?: string;
  name?: string;
  from_station_name?: string;
  to_station_name?: string;
};

type ManagerJob = {
  id: number | string;
  job_code: string;
  title: string;
  description?: string;
  asset_type?: string;
  job_type?: string;
  severity: string;
  status: string;
  required_skill?: string;
  required_authority?: string;
  estimated_minutes?: number;
  priority_score?: number;
  priority_reason?: string;
  predicted_failure_risk?: number;
  expected_train_impact?: number;
  estimated_delay_minutes?: number;
  km_marker?: number;
  planned_start?: string | null;
  planned_end?: string | null;
  actual_start?: string | null;
  actual_end?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  corridor?: Corridor | null;
  segment?: Segment | null;

  is_fixed?: boolean;
  inspection_status?: string;

  assigned_worker?: {
    worker_id?: number;
    employee_code?: string;
    designation?: string;
    assignment_status?: string;
    progress_percent?: number;
  } | null;

  fixed_by_worker?: {
    worker_id?: number;
    employee_code?: string;
    designation?: string;
  } | null;
};

type EligibleWorker = {
  worker_id?: number;
  id?: number;
  employee_code?: string;
  employee_id?: string;
  full_name?: string;
  name?: string;
  designation?: string;
  department?: string;
  railway_zone?: string;
  division?: string;
  availability_status?: string;
  availability?: string;
  proficiency_level?: number;
  years_experience?: number;
  workload_minutes?: number;
  current_workload_minutes?: number;
  remaining_capacity_minutes?: number;
  remaining_shift_minutes?: number;
  suitability_score?: number;
  ml_score?: number;
  suitability_reason?: string;
  reasons?: string[];
};

type ExtensionRequest = {
  id: number;
  maintenance_job_id?: number;
  assignment_id?: number;
  worker_id?: number;
  worker_code?: string;
  worker_name?: string;
  employee_code?: string;
  job_code?: string;
  job_title?: string;
  requested_minutes?: number;
  reason?: string;
  status?: string;
  requested_at?: string;
  created_at?: string;
  manager_note?: string;
};

type WorkforceSummary = {
  total: number;
  available: number;
  partial: number;
  unavailable: number;
};


const OPEN_STATUSES = new Set([
  "PENDING",
  "READY_FOR_ASSIGNMENT",
  "ASSIGNED",
  "IN_PROGRESS",
  "PAUSED",
  "EXTENSION_REQUESTED",
]);

function norm(value?: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function percentScore(worker: EligibleWorker) {
  const raw =
    worker.ml_score ??
    worker.suitability_score ??
    0;

  const n = numberValue(raw);

  return n <= 1
    ? Math.round(n * 1000) / 10
    : Math.round(n * 10) / 10;
}

function severityWeight(severity?: string) {
  switch (norm(severity)) {
    case "CRITICAL":
      return 4;
    case "HIGH":
      return 3;
    case "MEDIUM":
      return 2;
    case "LOW":
      return 1;
    default:
      return 0;
  }
}


function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status?: string) {
  return String(status ?? "UNKNOWN")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function getArray<T>(
  value:
    | T[]
    | { jobs?: T[] }
    | { corridors?: T[] }
    | { requests?: T[] }
    | { workers?: T[] }
    | { eligible_workers?: T[] }
    | null
    | undefined,
): T[] {
  if (Array.isArray(value)) return value;

  if (!value || typeof value !== "object") return [];

  const obj = value as Record<string, unknown>;

  for (const key of [
    "jobs",
    "corridors",
    "requests",
    "extension_requests",
    "workers",
    "eligible_workers",
    "items",
    "data",
  ]) {
    if (Array.isArray(obj[key])) {
      return obj[key] as T[];
    }
  }

  return [];
}


export default function ManagerDashboard() {
  const [jobs, setJobs] =
    useState<ManagerJob[]>([]);

  const [corridors, setCorridors] =
    useState<Corridor[]>([]);

  const [
    extensions,
    setExtensions,
  ] =
    useState<ExtensionRequest[]>([]);

  const [
    selectedJob,
    setSelectedJob,
  ] =
    useState<ManagerJob | null>(null);

  const [
    searchText,
    setSearchText,
  ] =
    useState("");

  const [
    corridorFilter,
    setCorridorFilter,
  ] =
    useState("ALL");

  const [
    severityFilter,
    setSeverityFilter,
  ] =
    useState("ALL");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState("ALL");

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    lastUpdated,
    setLastUpdated,
  ] =
    useState<Date | null>(null);

  const [
    eligibleWorkers,
    setEligibleWorkers,
  ] =
    useState<EligibleWorker[]>([]);

  const [
    workerModalOpen,
    setWorkerModalOpen,
  ] =
    useState(false);

  const [
    workerLoading,
    setWorkerLoading,
  ] =
    useState(false);

  const [
    assigningWorkerId,
    setAssigningWorkerId,
  ] =
    useState<number | null>(null);

  const [
    actionMessage,
    setActionMessage,
  ] =
    useState("");

  const [
    showExtensions,
    setShowExtensions,
  ] =
    useState(false);


  const [
    inspectModalOpen,
    setInspectModalOpen,
  ] =
    useState(false);


  const [
    workforce,
    setWorkforce,
  ] =
    useState<WorkforceSummary>({
      total: 0,
      available: 0,
      partial: 0,
      unavailable: 0,
    });


  const loadDashboard = useCallback(
    async (
      silent = false,
    ) => {
      if (!silent) {
        setIsLoading(true);
      }

      setErrorMessage("");

      const results =
        await Promise.allSettled([
          api.get(
            "/manager/jobs",
          ),

          api.get(
            "/manager/corridors",
          ),

          api.get(
            "/manager/extension-requests",
          ),

          api.get(
            "/manager/workforce-summary",
          ),
        ]);

      const [
        jobsResult,
        corridorsResult,
        extensionsResult,
        workforceResult,
      ] = results;

      let anySuccess = false;

      if (
        jobsResult.status
        === "fulfilled"
      ) {
        const loadedJobs =
          getArray<ManagerJob>(
            jobsResult.value.data,
          );

        setJobs(
          loadedJobs,
        );

        anySuccess = true;

        setSelectedJob(
          (current) => {
            if (!loadedJobs.length) {
              return null;
            }

            if (current) {
              const refreshed =
                loadedJobs.find(
                  (job) =>
                    job.id
                    === current.id,
                );

              if (refreshed) {
                return refreshed;
              }
            }

            const preferred =
              loadedJobs.find(
                (job) =>
                  job.job_code
                  === "JOB-TBM-001",
              );

            return (
              preferred ??
              [...loadedJobs]
                .sort(
                  (a, b) =>
                    severityWeight(
                      b.severity,
                    )
                    - severityWeight(
                      a.severity,
                    )
                    ||
                    numberValue(
                      b.priority_score,
                    )
                    - numberValue(
                      a.priority_score,
                    ),
                )[0]
            );
          },
        );
      }

      if (
        corridorsResult.status
        === "fulfilled"
      ) {
        setCorridors(
          getArray<Corridor>(
            corridorsResult.value.data,
          ),
        );

        anySuccess = true;
      }

      if (
        extensionsResult.status
        === "fulfilled"
      ) {
        setExtensions(
          getArray<ExtensionRequest>(
            extensionsResult.value.data,
          ),
        );

        anySuccess = true;
      }

      if (
        workforceResult.status
        === "fulfilled"
      ) {
        const data =
          workforceResult.value.data
          ?? {};

        setWorkforce({
          total:
            numberValue(
              data.total,
            ),
          available:
            numberValue(
              data.available,
            ),
          partial:
            numberValue(
              data.partial,
            ),
          unavailable:
            numberValue(
              data.unavailable,
            ),
        });

        anySuccess = true;
      }

      const failures =
        results.filter(
          (result) =>
            result.status
            === "rejected",
        );

      if (failures.length) {
        setErrorMessage(
          failures.length === 4
            ? "Unable to load Manager operations data."
            : "Some Manager data could not be refreshed. Available data is still shown.",
        );
      }

      if (anySuccess) {
        setLastUpdated(
          new Date(),
        );
      }

      if (!silent) {
        setIsLoading(false);
      }
    },
    [],
  );


  useEffect(() => {
    void loadDashboard();

    const interval =
      window.setInterval(
        () => {
          void loadDashboard(
            true,
          );
        },
        20000,
      );

    return () =>
      window.clearInterval(
        interval,
      );
  }, [loadDashboard]);


  const stats =
    useMemo(() => {
      const openJobs =
        jobs.filter(
          (job) =>
            OPEN_STATUSES.has(
              norm(job.status),
            ),
        );

      return {
        total:
          jobs.length,

        open:
          openJobs.length,

        critical:
          openJobs.filter(
            (job) =>
              norm(
                job.severity,
              )
              === "CRITICAL",
          ).length,

        active:
          openJobs.filter(
            (job) =>
              [
                "IN_PROGRESS",
                "PAUSED",
                "EXTENSION_REQUESTED",
              ].includes(
                norm(
                  job.status,
                ),
              ),
          ).length,

        ready:
          openJobs.filter(
            (job) =>
              norm(
                job.status,
              )
              ===
              "READY_FOR_ASSIGNMENT",
          ).length,

        extensions:
          extensions.filter(
            (request) =>
              norm(
                request.status,
              )
              === "PENDING",
          ).length,
      };
    }, [
      jobs,
      extensions,
    ]);


  const filteredJobs =
    useMemo(() => {
      const query =
        searchText
          .trim()
          .toLowerCase();

      return [...jobs]
        .filter(
          (job) => {
            if (
              corridorFilter
              !== "ALL"
            ) {
              const corridorId =
                String(
                  job.corridor
                    ?.id
                  ??
                  "",
                );

              if (
                corridorId
                !== corridorFilter
              ) {
                return false;
              }
            }

            if (
              severityFilter
              !== "ALL"
              &&
              norm(
                job.severity,
              )
              !== severityFilter
            ) {
              return false;
            }

            if (
              statusFilter
              !== "ALL"
              &&
              norm(
                job.status,
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
                job.job_code,
                job.title,
                job.description,
                job.asset_type,
                job.job_type,
                job.required_skill,
                job.required_authority,
                job.corridor
                  ?.name,
                job.segment
                  ?.name,
              ]
                .filter(
                  Boolean,
                )
                .join(
                  " ",
                )
                .toLowerCase();

            return haystack.includes(
              query,
            );
          },
        )
        .sort(
          (a, b) =>
            severityWeight(
              b.severity,
            )
            - severityWeight(
              a.severity,
            )
            ||
            numberValue(
              b.priority_score,
            )
            - numberValue(
              a.priority_score,
            ),
        );
    }, [
      jobs,
      searchText,
      corridorFilter,
      severityFilter,
      statusFilter,
    ]);


  const loadEligibleWorkers =
    async () => {
      if (!selectedJob) {
        return;
      }

      setActionMessage("");

      setWorkerLoading(
        true,
      );

      setWorkerModalOpen(
        true,
      );

      try {
        const response =
          await api.get(
            `/manager/jobs/${selectedJob.id}/eligible-workers`,
          );

        const workers =
          getArray<EligibleWorker>(
            response.data,
          )
            .sort(
              (a, b) =>
                percentScore(b)
                - percentScore(a),
            );

        setEligibleWorkers(
          workers,
        );
      } catch {
        setEligibleWorkers(
          [],
        );

        setActionMessage(
          "Unable to load eligible workers for this job.",
        );
      } finally {
        setWorkerLoading(
          false,
        );
      }
    };


  const assignWorker =
    async (
      worker:
        EligibleWorker,
    ) => {
      if (!selectedJob) {
        return;
      }

      const workerId =
        Number(
          worker.worker_id
          ??
          worker.id,
        );

      if (
        !Number.isFinite(
          workerId,
        )
      ) {
        setActionMessage(
          "Worker ID is missing.",
        );

        return;
      }

      setAssigningWorkerId(
        workerId,
      );

      setActionMessage("");

      try {
        await api.post(
          `/manager/jobs/${selectedJob.id}/assign`,
          {
            worker_id:
              workerId,
          },
        );

        setActionMessage(
          `Assigned ${worker.employee_code ?? worker.employee_id ?? "worker"} successfully.`,
        );

        await loadDashboard(
          true,
        );

        window.setTimeout(
          () => {
            setWorkerModalOpen(
              false,
            );
          },
          850,
        );
      } catch (error: any) {
        setActionMessage(
          error?.response
            ?.data
            ?.detail
          ??
          "Unable to assign this worker.",
        );
      } finally {
        setAssigningWorkerId(
          null,
        );
      }
    };


  const decideExtension =
    async (
      request:
        ExtensionRequest,

      decision:
        "approve"
        | "reject",
    ) => {
      setActionMessage("");

      try {
        await api.post(
          `/manager/extension-requests/${request.id}/${decision}`,
          {
            manager_note:
              decision
              === "approve"
                ? "Approved from RailSync Manager Control."
                : "Rejected from RailSync Manager Control.",
          },
        );

        await loadDashboard(
          true,
        );
      } catch (error: any) {
        setActionMessage(
          error?.response
            ?.data
            ?.detail
          ??
          `Unable to ${decision} extension request.`,
        );
      }
    };


  return (
    <main
      className="manager-dashboard"
      style={{
        minHeight:
          "100vh",

        background:
          "#f4efe5",

        color:
          "#17344a",
      }}
    >
      {/* ===================================================
          HEADER
          =================================================== */}

      <header
        style={{
          minHeight:
            72,

          display:
            "flex",

          alignItems:
            "center",

          justifyContent:
            "space-between",

          padding:
            "0 28px",

          background:
            "#103249",

          color:
            "#fff",

          borderBottom:
            "3px solid #d66a2d",
        }}
      >
        <div
          style={{
            display:
              "flex",

            alignItems:
              "center",

            gap:
              13,
          }}
        >
          <div
            style={{
              width:
                42,

              height:
                42,

              display:
                "grid",

              placeItems:
                "center",

              border:
                "1px solid rgba(255,255,255,.22)",

              borderRadius:
                9,
            }}
          >
            <Wrench
              size={
                22
              }
            />
          </div>

          <div>
            <strong
              style={{
                display:
                  "block",

                fontFamily:
                  "Georgia, serif",

                fontSize:
                  27,

                letterSpacing:
                  ".01em",
              }}
            >
              RailSync
            </strong>

            <span
              style={{
                display:
                  "block",

                fontSize:
                  10,

                fontWeight:
                  800,

                letterSpacing:
                  ".17em",

                color:
                  "#b9cbd6",
              }}
            >
              INDIAN RAILWAYS · MAINTENANCE CONTROL
            </span>
          </div>
        </div>

        <div
          style={{
            display:
              "flex",

            alignItems:
              "center",

            gap:
              9,
          }}
        >
          <div
            style={{
              padding:
                "9px 12px",

              borderRadius:
                7,

              background:
                "rgba(255,255,255,.08)",

              fontSize:
                11,

              fontWeight:
                800,
            }}
          >
            <Activity
              size={
                14
              }
              style={{
                verticalAlign:
                  "middle",

                marginRight:
                  6,
              }}
            />

            {errorMessage
              ? "API DEGRADED"
              : "API ONLINE"}
          </div>

          <button
            type="button"
            onClick={() =>
              setShowExtensions(
                true,
              )
            }
            style={{
              position:
                "relative",

              width:
                42,

              height:
                42,

              border:
                0,

              borderRadius:
                8,

              background:
                "rgba(255,255,255,.08)",

              color:
                "#fff",

              cursor:
                "pointer",
            }}
          >
            <Bell
              size={
                18
              }
            />

            {stats.extensions
              > 0
              && (
                <span
                  style={{
                    position:
                      "absolute",

                    right:
                      -3,

                    top:
                      -3,

                    minWidth:
                      18,

                    height:
                      18,

                    display:
                      "grid",

                    placeItems:
                      "center",

                    borderRadius:
                      99,

                    background:
                      "#d64a36",

                    color:
                      "#fff",

                    fontSize:
                      9,

                    fontWeight:
                      900,
                  }}
                >
                  {
                    stats.extensions
                  }
                </span>
              )}
          </button>

          <button
            type="button"
            onClick={() =>
              void loadDashboard()
            }
            disabled={
              isLoading
            }
            style={{
              height:
                42,

              display:
                "flex",

              alignItems:
                "center",

              gap:
                7,

              padding:
                "0 13px",

              border:
                0,

              borderRadius:
                8,

              background:
                "rgba(255,255,255,.08)",

              color:
                "#fff",

              cursor:
                "pointer",

              fontWeight:
                800,
            }}
          >
            <RefreshCw
              size={
                16
              }
            />

            Refresh
          </button>
        </div>
      </header>


      {/* ===================================================
          BODY
          =================================================== */}

      <section
        style={{
          maxWidth:
            1640,

          margin:
            "0 auto",

          padding:
            "16px 24px 32px",
        }}
      >
        {errorMessage
          && (
            <div
              style={{
                marginBottom:
                  12,

                padding:
                  "10px 13px",

                border:
                  "1px solid #edc7b7",

                borderRadius:
                  7,

                background:
                  "#fff3ed",

                color:
                  "#974827",

                fontSize:
                  12,

                fontWeight:
                  700,
              }}
            >
              <AlertTriangle
                size={
                  15
                }
                style={{
                  marginRight:
                    7,

                  verticalAlign:
                    "middle",
                }}
              />

              {
                errorMessage
              }
            </div>
          )}


        {/* KPI */}

        <section
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(5, minmax(0, 1fr))",

            gap:
              12,

            marginBottom:
              15,
          }}
        >
          {[
            {
              label:
                "TOTAL RECORDS",

              value:
                stats.total,

              Icon:
                Wrench,
            },

            {
              label:
                "CRITICAL",

              value:
                stats.critical,

              Icon:
                ShieldAlert,
            },

            {
              label:
                "ACTIVE WORK",

              value:
                stats.active,

              Icon:
                Activity,
            },

            {
              label:
                "READY TO ASSIGN",

              value:
                stats.ready,

              Icon:
                UserRoundCheck,
            },

            {
              label:
                "EXTENSIONS",

              value:
                stats.extensions,

              Icon:
                Clock3,
            },
          ].map(
            ({
              label,
              value,
              Icon,
            }) => (
              <article
                key={
                  label
                }
                style={{
                  minHeight:
                    76,

                  display:
                    "flex",

                  alignItems:
                    "center",

                  gap:
                    12,

                  padding:
                    "12px 16px",

                  border:
                    "1px solid #dfd3c2",

                  borderRadius:
                    10,

                  background:
                    "#fffdf9",
                }}
              >
                <div
                  style={{
                    width:
                      38,

                    height:
                      38,

                    display:
                      "grid",

                    placeItems:
                      "center",

                    borderRadius:
                      9,

                    background:
                      "#edf2f3",
                  }}
                >
                  <Icon
                    size={
                      19
                    }
                  />
                </div>

                <div>
                  <span
                    style={{
                      display:
                        "block",

                      color:
                        "#71818b",

                      fontSize:
                        9,

                      fontWeight:
                        800,

                      letterSpacing:
                        ".13em",
                    }}
                  >
                    {
                      label
                    }
                  </span>

                  <strong
                    style={{
                      display:
                        "block",

                      marginTop:
                        2,

                      fontFamily:
                        "Georgia, serif",

                      fontSize:
                        26,
                    }}
                  >
                    {
                      value
                    }
                  </strong>
                </div>
              </article>
            ),
          )}
        </section>



        {/* WORKFORCE STATUS */}

        <section
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "1.4fr repeat(3, minmax(0, 1fr))",

            gap:
              10,

            marginBottom:
              15,
          }}
        >
          <article
            style={{
              padding:
                "12px 15px",

              border:
                "1px solid #d9cfbf",

              borderRadius:
                9,

              background:
                "#103249",

              color:
                "#fff",
            }}
          >
            <span
              style={{
                display:
                  "block",

                color:
                  "#d8a25b",

                fontSize:
                  9,

                fontWeight:
                  900,

                letterSpacing:
                  ".12em",
              }}
            >
              MAINTENANCE WORKFORCE
            </span>

            <strong
              style={{
                display:
                  "block",

                marginTop:
                  4,

                fontFamily:
                  "Georgia, serif",

                fontSize:
                  23,
              }}
            >
              {
                workforce.total
              } workers
            </strong>
          </article>

          {[
            {
              label:
                "AVAILABLE",

              value:
                workforce.available,

              color:
                "#26734c",

              background:
                "#edf6ef",
            },

            {
              label:
                "PARTIAL",

              value:
                workforce.partial,

              color:
                "#a26922",

              background:
                "#fff5df",
            },

            {
              label:
                "UNAVAILABLE",

              value:
                workforce.unavailable,

              color:
                "#aa3d35",

              background:
                "#fff0ed",
            },
          ].map(
            (
              item,
            ) => (
              <article
                key={
                  item.label
                }
                style={{
                  display:
                    "flex",

                  alignItems:
                    "center",

                  justifyContent:
                    "space-between",

                  padding:
                    "12px 15px",

                  border:
                    "1px solid #d9cfbf",

                  borderRadius:
                    9,

                  background:
                    item.background,
                }}
              >
                <div>
                  <span
                    style={{
                      display:
                        "block",

                      color:
                        item.color,

                      fontSize:
                        9,

                      fontWeight:
                        900,

                      letterSpacing:
                        ".1em",
                    }}
                  >
                    {
                      item.label
                    }
                  </span>

                  <strong
                    style={{
                      display:
                        "block",

                      marginTop:
                        3,

                      color:
                        item.color,

                      fontFamily:
                        "Georgia, serif",

                      fontSize:
                        24,
                    }}
                  >
                    {
                      item.value
                    }
                  </strong>
                </div>

                <Users
                  size={
                    20
                  }
                  color={
                    item.color
                  }
                />
              </article>
            ),
          )}
        </section>


        {stats.extensions > 0 && (
          <section
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 14,
              padding: "12px 15px",
              border: "1px solid #e3bd82",
              borderLeft: "5px solid #d98728",
              borderRadius: 9,
              background: "#fff4df",
            }}
          >
            <div>
              <span style={{ display: "block", color: "#9b5d20", fontSize: 9, fontWeight: 900, letterSpacing: ".12em" }}>
                WORKER TIME EXTENSION REQUEST
              </span>
              <strong style={{ display: "block", marginTop: 3, fontFamily: "Georgia, serif", fontSize: 17, color: "#17384b" }}>
                {stats.extensions} request{stats.extensions === 1 ? "" : "s"} awaiting Manager decision
              </strong>
            </div>
            <button
              type="button"
              onClick={() => setShowExtensions(true)}
              style={{
                minHeight: 38,
                border: 0,
                borderRadius: 6,
                padding: "0 15px",
                background: "#164862",
                color: "#fff",
                cursor: "pointer",
                fontSize: 10,
                fontWeight: 900,
              }}
            >
              Review · Accept / Reject
            </button>
          </section>
        )}

        {/* MAP + JOB CONTROL */}

        <section
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "minmax(0, 2.25fr) minmax(320px, .95fr)",

            gap:
              14,

            marginBottom:
              14,
          }}
        >
          <article
            style={{
              overflow:
                "hidden",

              border:
                "1px solid #dfd3c2",

              borderRadius:
                10,

              background:
                "#fffdf9",
            }}
          >
            <div
              style={{
                minHeight:
                  64,

                display:
                  "flex",

                alignItems:
                  "center",

                justifyContent:
                  "space-between",

                padding:
                  "0 16px",

                borderBottom:
                  "1px solid #e8ded0",
              }}
            >
              <div>
                <span
                  style={{
                    display:
                      "block",

                    color:
                      "#9a5c21",

                    fontSize:
                      9,

                    fontWeight:
                      900,

                    letterSpacing:
                      ".16em",
                  }}
                >
                  RAILWAY NETWORK
                </span>

                <h2
                  style={{
                    margin:
                      "2px 0 0",

                    fontFamily:
                      "Georgia, serif",

                    fontSize:
                      21,
                  }}
                >
                  Maintenance Operations Map
                </h2>
              </div>

              <span
                style={{
                  padding:
                    "6px 9px",

                  border:
                    "1px solid #dfc28f",

                  borderRadius:
                    6,

                  background:
                    "#fff3dc",

                  color:
                    "#925c16",

                  fontSize:
                    9,

                  fontWeight:
                    900,

                  letterSpacing:
                    ".09em",
                }}
              >
                DEMO REPLAY
              </span>
            </div>

            <div
              style={{
                height:
                  480,
              }}
            >
              <ManagerSmartMap
                jobs={
                  jobs
                }
                selectedJob={
                  selectedJob
                }
                onSelectJob={(job) =>
                  setSelectedJob(job as ManagerJob)
                }
              />
            </div>
          </article>


          <article
            style={{
              minHeight:
                544,

              border:
                "1px solid #dfd3c2",

              borderRadius:
                10,

              background:
                "#fffdf9",

              overflow:
                "hidden",
            }}
          >
            <div
              style={{
                minHeight:
                  64,

                display:
                  "flex",

                alignItems:
                  "center",

                gap:
                  10,

                padding:
                  "0 16px",

                borderBottom:
                  "1px solid #e8ded0",
              }}
            >
              <MapPinned
                size={
                  19
                }
              />

              <div>
                <span
                  style={{
                    display:
                      "block",

                    color:
                      "#9a5c21",

                    fontSize:
                      9,

                    fontWeight:
                      900,

                    letterSpacing:
                      ".14em",
                  }}
                >
                  SELECTED MAINTENANCE JOB
                </span>

                <h2
                  style={{
                    margin:
                      "2px 0 0",

                    fontFamily:
                      "Georgia, serif",

                    fontSize:
                      21,
                  }}
                >
                  Job Control
                </h2>
              </div>
            </div>

            {!selectedJob
              ? (
                <div
                  style={{
                    padding:
                      24,

                    color:
                      "#6c7b83",
                  }}
                >
                  Select a maintenance
                  job from the map or
                  priority queue.
                </div>
              )
              : (
                <div
                  style={{
                    padding:
                      16,
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",

                      justifyContent:
                        "space-between",

                      gap:
                        8,

                      marginBottom:
                        15,
                    }}
                  >
                    <span
                      style={{
                        padding:
                          "5px 8px",

                        borderRadius:
                          5,

                        background:
                          norm(
                            selectedJob
                              .severity,
                          )
                          === "CRITICAL"
                            ? "#fee0da"
                            : "#fff0d8",

                        color:
                          norm(
                            selectedJob
                              .severity,
                          )
                          === "CRITICAL"
                            ? "#b43127"
                            : "#a05b20",

                        fontSize:
                          9,

                        fontWeight:
                          900,
                      }}
                    >
                      {
                        selectedJob
                          .severity
                      }
                    </span>

                    <span
                      style={{
                        padding:
                          "5px 8px",

                        borderRadius:
                          5,

                        background:
                          "#edf2f3",

                        color:
                          "#4c6978",

                        fontSize:
                          9,

                        fontWeight:
                          800,
                      }}
                    >
                      {
                        statusLabel(
                          selectedJob
                            .status,
                        )
                      }
                    </span>
                  </div>

                  <span
                    style={{
                      color:
                        "#9a5c21",

                      fontWeight:
                        900,

                      letterSpacing:
                        ".07em",
                    }}
                  >
                    {
                      selectedJob
                        .job_code
                    }
                  </span>

                  <h1
                    style={{
                      margin:
                        "5px 0 8px",

                      fontFamily:
                        "Georgia, serif",

                      fontSize:
                        25,

                      lineHeight:
                        1.08,
                    }}
                  >
                    {
                      selectedJob
                        .title
                    }
                  </h1>

                  <p
                    style={{
                      margin:
                        0,

                      color:
                        "#697982",

                      fontSize:
                        12,

                      lineHeight:
                        1.6,
                    }}
                  >
                    {
                      selectedJob
                        .description
                      ??
                      "No additional job description."
                    }
                  </p>

                  <div
                    style={{
                      display:
                        "grid",

                      gridTemplateColumns:
                        "1fr 1fr",

                      gap:
                        8,

                      marginTop:
                        17,
                    }}
                  >
                    {[
                      [
                        "Corridor",
                        selectedJob
                          .corridor
                          ?.name
                        ?? "—",
                      ],

                      [
                        "Section",
                        selectedJob
                          .segment
                          ?.name
                        ?? "—",
                      ],

                      [
                        "Required Skill",
                        selectedJob
                          .required_skill
                        ?? "—",
                      ],

                      [
                        "Authority",
                        selectedJob
                          .required_authority
                        ?? "—",
                      ],

                      [
                        "Estimate",
                        `${numberValue(
                          selectedJob
                            .estimated_minutes,
                        )} min`,
                      ],

                      [
                        "AI Priority",
                        String(
                          selectedJob
                            .priority_score
                          ?? "—",
                        ),
                      ],
                    ].map(
                      ([
                        label,
                        value,
                      ]) => (
                        <div
                          key={
                            label
                          }
                          style={{
                            minHeight:
                              49,

                            padding:
                              "9px 10px",

                            border:
                              "1px solid #e4d9ca",

                            borderRadius:
                              7,

                            background:
                              "#f8f4ed",
                          }}
                        >
                          <small
                            style={{
                              display:
                                "block",

                              color:
                                "#839099",

                              fontSize:
                                8,

                              fontWeight:
                                900,

                              letterSpacing:
                                ".12em",
                            }}
                          >
                            {
                              label
                            }
                          </small>

                          <strong
                            style={{
                              display:
                                "block",

                              marginTop:
                                4,

                              fontSize:
                                11,
                            }}
                          >
                            {
                              value
                            }
                          </strong>
                        </div>
                      ),
                    )}
                  </div>

                  <div
                    style={{
                      marginTop:
                        12,

                      padding:
                        12,

                      borderRadius:
                        7,

                      background:
                        "#edf3f5",
                    }}
                  >
                    <strong
                      style={{
                        display:
                          "block",

                        marginBottom:
                          5,

                        color:
                          "#234b62",

                        fontSize:
                          9,

                        letterSpacing:
                          ".1em",
                      }}
                    >
                      AI PRIORITY REASON
                    </strong>

                    <span
                      style={{
                        color:
                          "#536873",

                        fontSize:
                          11,
                      }}
                    >
                      {
                        selectedJob
                          .priority_reason
                        ??
                        "Priority derived from safety, asset condition and expected operational impact."
                      }
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void loadEligibleWorkers()
                    }
                    disabled={
                      norm(
                        selectedJob
                          .status,
                      )
                      !==
                      "READY_FOR_ASSIGNMENT"
                      &&
                      norm(
                        selectedJob
                          .status,
                      )
                      !==
                      "PENDING"
                    }
                    style={{
                      width:
                        "100%",

                      minHeight:
                        44,

                      display:
                        "flex",

                      alignItems:
                        "center",

                      justifyContent:
                        "center",

                      gap:
                        8,

                      marginTop:
                        14,

                      border:
                        0,

                      borderRadius:
                        7,

                      background:
                        "#164862",

                      color:
                        "#fff",

                      cursor:
                        "pointer",

                      fontWeight:
                        900,

                      opacity:
                        [
                          "READY_FOR_ASSIGNMENT",
                          "PENDING",
                        ].includes(
                          norm(
                            selectedJob
                              .status,
                          ),
                        )
                          ? 1
                          : .55,
                    }}
                  >
                    <Users
                      size={
                        17
                      }
                    />

                    Find Eligible Workers
                  </button>
                </div>
              )}
          </article>
        </section>


        {/* JOB TABLE */}

        <article
          style={{
            border:
              "1px solid #dfd3c2",

            borderRadius:
              10,

            background:
              "#fffdf9",

            overflow:
              "hidden",
          }}
        >
          <div
            style={{
              display:
                "flex",

              alignItems:
                "center",

              justifyContent:
                "space-between",

              gap:
                15,

              padding:
                "13px 16px",

              borderBottom:
                "1px solid #e4d9ca",
            }}
          >
            <div>
              <span
                style={{
                  color:
                    "#9a5c21",

                  fontSize:
                    9,

                  fontWeight:
                    900,

                  letterSpacing:
                    ".15em",
                }}
              >
                AI PRIORITY QUEUE
              </span>

              <h2
                style={{
                  margin:
                    "2px 0 0",

                  fontFamily:
                    "Georgia, serif",

                  fontSize:
                    22,
                }}
              >
                Maintenance Jobs
              </h2>
            </div>

            <div
              style={{
                display:
                  "flex",

                gap:
                  7,

                alignItems:
                  "center",

                flexWrap:
                  "wrap",
              }}
            >
              <label
                style={{
                  height:
                    36,

                  display:
                    "flex",

                  alignItems:
                    "center",

                  gap:
                    6,

                  padding:
                    "0 10px",

                  border:
                    "1px solid #ddcfbd",

                  borderRadius:
                    6,

                  background:
                    "#fff",
                }}
              >
                <Search
                  size={
                    14
                  }
                />

                <input
                  value={
                    searchText
                  }
                  onChange={(
                    event,
                  ) =>
                    setSearchText(
                      event
                        .target
                        .value,
                    )}
                  placeholder="Search jobs..."
                  style={{
                    width:
                      160,

                    border:
                      0,

                    outline:
                      0,
                  }}
                />
              </label>

              <label
                style={{
                  display:
                    "flex",

                  alignItems:
                    "center",

                  gap:
                    5,
                }}
              >
                <Filter
                  size={
                    14
                  }
                />

                <select
                  value={
                    corridorFilter
                  }
                  onChange={(
                    event,
                  ) =>
                    setCorridorFilter(
                      event
                        .target
                        .value,
                    )}
                  style={{
                    height:
                      36,

                    minWidth:
                      170,

                    border:
                      "1px solid #ddcfbd",

                    borderRadius:
                      6,

                    background:
                      "#fff",

                    padding:
                      "0 8px",
                  }}
                >
                  <option
                    value="ALL"
                  >
                    All Corridors
                  </option>

                  {
                    corridors.map(
                      (
                        corridor,
                      ) => (
                        <option
                          key={
                            corridor.id
                          }
                          value={
                            String(
                              corridor.id,
                            )
                          }
                        >
                          {
                            corridor.name
                            ??
                            corridor.corridor_code
                          }
                        </option>
                      ),
                    )
                  }
                </select>
              </label>

              <select
                value={
                  severityFilter
                }
                onChange={(
                  event,
                ) =>
                  setSeverityFilter(
                    event
                      .target
                      .value,
                  )}
                style={{
                  height:
                    36,

                  border:
                    "1px solid #ddcfbd",

                  borderRadius:
                    6,

                  background:
                    "#fff",

                  padding:
                    "0 8px",
                }}
              >
                <option
                  value="ALL"
                >
                  All Severity
                </option>

                <option
                  value="CRITICAL"
                >
                  Critical
                </option>

                <option
                  value="HIGH"
                >
                  High
                </option>

                <option
                  value="MEDIUM"
                >
                  Medium
                </option>

                <option
                  value="LOW"
                >
                  Low
                </option>
              </select>

              <select
                value={
                  statusFilter
                }
                onChange={(
                  event,
                ) =>
                  setStatusFilter(
                    event
                      .target
                      .value,
                  )}
                style={{
                  height:
                    36,

                  border:
                    "1px solid #ddcfbd",

                  borderRadius:
                    6,

                  background:
                    "#fff",

                  padding:
                    "0 8px",
                }}
              >
                <option
                  value="ALL"
                >
                  All Status
                </option>

                <option
                  value="READY_FOR_ASSIGNMENT"
                >
                  Ready for Assignment
                </option>

                <option
                  value="ASSIGNED"
                >
                  Assigned
                </option>

                <option
                  value="IN_PROGRESS"
                >
                  In Progress
                </option>

                <option
                  value="PAUSED"
                >
                  Paused
                </option>

                <option
                  value="COMPLETED"
                >
                  Completed
                </option>
              </select>
            </div>
          </div>


          <div
            style={{
              maxHeight:
                470,

              overflow:
                "auto",
            }}
          >
            <table
              style={{
                width:
                  "100%",

                borderCollapse:
                  "collapse",

                fontSize:
                  11,
              }}
            >
              <thead
                style={{
                  position:
                    "sticky",

                  top:
                    0,

                  zIndex:
                    2,

                  background:
                    "#f1eadf",
                }}
              >
                <tr>
                  {[
                    "PRIORITY",
                    "JOB",
                    "CORRIDOR / SECTION",
                    "STATUS",
                    "ESTIMATE",
                    "ACTION",
                  ].map(
                    (label) => (
                      <th
                        key={
                          label
                        }
                        style={{
                          padding:
                            "10px 12px",

                          textAlign:
                            "left",

                          color:
                            "#785c42",

                          fontSize:
                            9,

                          letterSpacing:
                            ".08em",
                        }}
                      >
                        {
                          label
                        }
                      </th>
                    ),
                  )}
                </tr>
              </thead>

              <tbody>
                {
                  filteredJobs
                    .slice(
                      0,
                      250,
                    )
                    .map(
                      (
                        job,
                      ) => (
                        <tr
                          key={
                            job.id
                          }
                          onClick={() =>
                            setSelectedJob(
                              job,
                            )
                          }
                          style={{
                            borderTop:
                              "1px solid #eee5d9",

                            background:
                              selectedJob
                                ?.id
                              === job.id
                                ? "#fff5e8"
                                : "#fffdf9",

                            cursor:
                              "pointer",
                          }}
                        >
                          <td
                            style={{
                              padding:
                                "10px 12px",

                              verticalAlign:
                                "top",
                            }}
                          >
                            <strong>
                              {
                                job.priority_score
                                ?? "—"
                              }
                            </strong>

                            <div
                              style={{
                                width:
                                  "fit-content",

                                marginTop:
                                  4,

                                padding:
                                  "3px 6px",

                                borderRadius:
                                  4,

                                background:
                                  norm(
                                    job.severity,
                                  )
                                  === "CRITICAL"
                                    ? "#fee0da"
                                    : norm(
                                      job.severity,
                                    )
                                    === "HIGH"
                                      ? "#ffead8"
                                      : "#f4ecd8",

                                color:
                                  norm(
                                    job.severity,
                                  )
                                  === "CRITICAL"
                                    ? "#b6342b"
                                    : "#955a23",

                                fontSize:
                                  8,

                                fontWeight:
                                  900,
                              }}
                            >
                              {
                                job.severity
                              }
                            </div>
                          </td>

                          <td
                            style={{
                              padding:
                                "10px 12px",

                              verticalAlign:
                                "top",
                            }}
                          >
                            <strong
                              style={{
                                display:
                                  "block",
                              }}
                            >
                              {
                                job.job_code
                              }
                            </strong>

                            <span
                              style={{
                                display:
                                  "block",

                                marginTop:
                                  3,

                                color:
                                  "#6b7a83",
                              }}
                            >
                              {
                                job.title
                              }
                            </span>
                          </td>

                          <td
                            style={{
                              padding:
                                "10px 12px",

                              verticalAlign:
                                "top",
                            }}
                          >
                            <strong>
                              {
                                job.corridor
                                  ?.name
                                ?? "—"
                              }
                            </strong>

                            <span
                              style={{
                                display:
                                  "block",

                                marginTop:
                                  3,

                                color:
                                  "#75838b",
                              }}
                            >
                              {
                                job.segment
                                  ?.name
                                ?? "—"
                              }
                            </span>
                          </td>

                          <td
                            style={{
                              padding:
                                "10px 12px",
                            }}
                          >
                            {
                              statusLabel(
                                job.status,
                              )
                            }
                          </td>

                          <td
                            style={{
                              padding:
                                "10px 12px",
                            }}
                          >
                            {
                              job.estimated_minutes
                              ?? "—"
                            } min
                          </td>

                          <td
                            style={{
                              padding:
                                "10px 12px",
                            }}
                          >
                            <button
                              type="button"
                              onClick={(
                                event,
                              ) => {
                                event.stopPropagation();

                                setSelectedJob(
                                  job,
                                );

                                if (
                                  [
                                    "READY_FOR_ASSIGNMENT",
                                    "PENDING",
                                  ].includes(
                                    norm(
                                      job.status,
                                    ),
                                  )
                                ) {
                                  window.setTimeout(
                                    () => {
                                      setWorkerModalOpen(
                                        true,
                                      );

                                      void (
                                        async () => {
                                          setWorkerLoading(
                                            true,
                                          );

                                          try {
                                            const response =
                                              await api.get(
                                                `/manager/jobs/${job.id}/eligible-workers`,
                                              );

                                            setEligibleWorkers(
                                              getArray<EligibleWorker>(
                                                response.data,
                                              )
                                                .sort(
                                                  (
                                                    a,
                                                    b,
                                                  ) =>
                                                    percentScore(
                                                      b,
                                                    )
                                                    - percentScore(
                                                      a,
                                                    ),
                                                ),
                                            );
                                          } finally {
                                            setWorkerLoading(
                                              false,
                                            );
                                          }
                                        }
                                      )();
                                    },
                                    0,
                                  );
                                } else {
                                  setInspectModalOpen(
                                    true,
                                  );
                                }
                              }}
                              style={{
                                minWidth:
                                  78,

                                height:
                                  31,

                                border:
                                  0,

                                borderRadius:
                                  5,

                                background:
                                  "#164862",

                                color:
                                  "#fff",

                                cursor:
                                  "pointer",

                                fontSize:
                                  10,

                                fontWeight:
                                  800,
                              }}
                            >
                              {
                                [
                                  "READY_FOR_ASSIGNMENT",
                                  "PENDING",
                                ].includes(
                                  norm(
                                    job.status,
                                  ),
                                )
                                  ? "Assign"
                                  : "Inspect"
                              }
                            </button>
                          </td>
                        </tr>
                      ),
                    )
                }
              </tbody>
            </table>
          </div>

          <div
            style={{
              display:
                "flex",

              justifyContent:
                "space-between",

              padding:
                "9px 14px",

              borderTop:
                "1px solid #e6dbcd",

              color:
                "#78868e",

              fontSize:
                10,
            }}
          >
            <span>
              Showing{" "}
              {
                Math.min(
                  filteredJobs.length,
                  250,
                )
              }{" "}
              of{" "}
              {
                filteredJobs.length
              }{" "}
              matching records
            </span>

            <span>
              Last refresh:{" "}
              {
                lastUpdated
                  ? lastUpdated.toLocaleTimeString(
                    "en-IN",
                  )
                  : "—"
              }
            </span>
          </div>
        </article>
      </section>



      {/* ===================================================
          JOB INSPECTION MODAL
          =================================================== */}

      {inspectModalOpen
        && selectedJob
        && (
          <div
            style={{
              position:
                "fixed",

              inset:
                0,

              zIndex:
                5200,

              display:
                "grid",

              placeItems:
                "center",

              padding:
                24,

              background:
                "rgba(5,22,33,.72)",
            }}
          >
            <section
              style={{
                width:
                  "min(820px, 96vw)",

                maxHeight:
                  "88vh",

                overflow:
                  "hidden",

                borderRadius:
                  12,

                background:
                  "#fffdf9",

                boxShadow:
                  "0 25px 70px rgba(0,0,0,.3)",
              }}
            >
              <header
                style={{
                  minHeight:
                    70,

                  display:
                    "flex",

                  alignItems:
                    "center",

                  justifyContent:
                    "space-between",

                  padding:
                    "0 18px",

                  borderBottom:
                    "1px solid #e4d8c8",
                }}
              >
                <div>
                  <span
                    style={{
                      color:
                        "#9b5d20",

                      fontSize:
                        9,

                      fontWeight:
                        900,

                      letterSpacing:
                        ".14em",
                    }}
                  >
                    MAINTENANCE JOB INSPECTION
                  </span>

                  <h2
                    style={{
                      margin:
                        "3px 0 0",

                      fontFamily:
                        "Georgia, serif",
                    }}
                  >
                    {
                      selectedJob.job_code
                    }{" "}
                    ·{" "}
                    {
                      selectedJob.title
                    }
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setInspectModalOpen(
                      false,
                    )
                  }
                  style={{
                    width:
                      38,

                    height:
                      38,

                    border:
                      0,

                    borderRadius:
                      7,

                    background:
                      "#eef2f3",

                    cursor:
                      "pointer",
                  }}
                >
                  <X
                    size={
                      18
                    }
                  />
                </button>
              </header>

              <div
                style={{
                  padding:
                    16,

                  overflow:
                    "auto",

                  maxHeight:
                    "calc(88vh - 70px)",
                }}
              >
                <div
                  style={{
                    display:
                      "grid",

                    gridTemplateColumns:
                      "repeat(4, minmax(0, 1fr))",

                    gap:
                      9,

                    marginBottom:
                      14,
                  }}
                >
                  {[
                    [
                      "SEVERITY",
                      selectedJob.severity
                      ?? "—",
                    ],
                    [
                      "STATUS",
                      statusLabel(
                        selectedJob.status,
                      ),
                    ],
                    [
                      "AI PRIORITY",
                      String(
                        selectedJob.priority_score
                        ?? "—",
                      ),
                    ],
                    [
                      "ESTIMATE",
                      `${numberValue(
                        selectedJob.estimated_minutes,
                      )} min`,
                    ],
                  ].map(
                    ([
                      label,
                      value,
                    ]) => (
                      <div
                        key={
                          label
                        }
                        style={{
                          padding:
                            "10px 11px",

                          border:
                            "1px solid #e1d6c7",

                          borderRadius:
                            7,

                          background:
                            "#f7f2ea",
                        }}
                      >
                        <small
                          style={{
                            display:
                              "block",

                            color:
                              "#7c8b93",

                            fontSize:
                              8,

                            fontWeight:
                              900,

                            letterSpacing:
                              ".1em",
                          }}
                        >
                          {
                            label
                          }
                        </small>

                        <strong
                          style={{
                            display:
                              "block",

                            marginTop:
                              4,

                            fontSize:
                              12,
                          }}
                        >
                          {
                            value
                          }
                        </strong>
                      </div>
                    ),
                  )}
                </div>

                <div
                  style={{
                    display:
                      "grid",

                    gridTemplateColumns:
                      "1fr 1fr",

                    gap:
                      10,
                  }}
                >
                  <div
                    style={{
                      padding:
                        13,

                      border:
                        "1px solid #e3d8c9",

                      borderRadius:
                        8,

                      background:
                        "#fff",
                    }}
                  >
                    <span
                      style={{
                        display:
                          "block",

                        color:
                          "#9b5d20",

                        fontSize:
                          8,

                        fontWeight:
                          900,

                        letterSpacing:
                          ".1em",
                      }}
                    >
                      ASSIGNED WORKER
                    </span>

                    <strong
                      style={{
                        display:
                          "block",

                        marginTop:
                          7,

                        fontSize:
                          16,
                      }}
                    >
                      {
                        selectedJob.assigned_worker
                          ?.employee_code
                        ??
                        selectedJob.fixed_by_worker
                          ?.employee_code
                        ??
                        "Not assigned"
                      }
                    </strong>

                    <div
                      style={{
                        marginTop:
                          7,

                        color:
                          "#667982",

                        fontSize:
                          11,

                        lineHeight:
                          1.6,
                      }}
                    >
                      Designation:{" "}
                      <b>
                        {
                          selectedJob.assigned_worker
                            ?.designation
                          ??
                          selectedJob.fixed_by_worker
                            ?.designation
                          ??
                          "—"
                        }
                      </b>
                      <br />

                      Assignment status:{" "}
                      <b>
                        {
                          statusLabel(
                            selectedJob.assigned_worker
                              ?.assignment_status
                            ??
                            selectedJob.status,
                          )
                        }
                      </b>
                      <br />

                      Progress:{" "}
                      <b>
                        {
                          selectedJob.assigned_worker
                            ?.progress_percent
                          ?? (
                            norm(
                              selectedJob.status,
                            )
                            === "COMPLETED"
                              ? 100
                              : 0
                          )
                        }%
                      </b>
                    </div>
                  </div>

                  <div
                    style={{
                      padding:
                        13,

                      border:
                        "1px solid #e3d8c9",

                      borderRadius:
                        8,

                      background:
                        norm(
                          selectedJob.status,
                        )
                        === "COMPLETED"
                          ? "#edf6ef"
                          : "#f4f2ed",
                    }}
                  >
                    <span
                      style={{
                        display:
                          "block",

                        color:
                          norm(
                            selectedJob.status,
                          )
                          === "COMPLETED"
                            ? "#28724d"
                            : "#7b6c58",

                        fontSize:
                          8,

                        fontWeight:
                          900,

                        letterSpacing:
                          ".1em",
                      }}
                    >
                      INSPECTION / FIX STATUS
                    </span>

                    <strong
                      style={{
                        display:
                          "block",

                        marginTop:
                          7,

                        fontSize:
                          16,

                        color:
                          norm(
                            selectedJob.status,
                          )
                          === "COMPLETED"
                            ? "#28724d"
                            : "#18384b",
                      }}
                    >
                      {
                        norm(
                          selectedJob.status,
                        )
                        === "COMPLETED"
                          ? "FIXED"
                          : "WORK IN PROGRESS"
                      }
                    </strong>

                    <div
                      style={{
                        marginTop:
                          7,

                        color:
                          "#667982",

                        fontSize:
                          11,

                        lineHeight:
                          1.6,
                      }}
                    >
                      Inspection:{" "}
                      <b>
                        {
                          selectedJob.inspection_status
                          ??
                          (
                            norm(
                              selectedJob.status,
                            )
                            === "COMPLETED"
                              ? "COMPLETED"
                              : "PENDING"
                          )
                        }
                      </b>
                      <br />

                      Completed at:{" "}
                      <b>
                        {
                          formatDateTime(
                            selectedJob.actual_end,
                          )
                        }
                      </b>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop:
                      11,

                    padding:
                      13,

                    border:
                      "1px solid #e3d8c9",

                    borderRadius:
                      8,

                    background:
                      "#f8f4ed",

                    fontSize:
                      11,

                    lineHeight:
                      1.65,
                  }}
                >
                  <strong>
                    {
                      selectedJob.description
                      ??
                      "No additional maintenance description."
                    }
                  </strong>

                  <div
                    style={{
                      marginTop:
                        8,

                      color:
                        "#667982",
                    }}
                  >
                    Corridor:{" "}
                    <b>
                      {
                        selectedJob.corridor
                          ?.name
                        ?? "—"
                      }
                    </b>
                    <br />

                    Section:{" "}
                    <b>
                      {
                        selectedJob.segment
                          ?.name
                        ?? "—"
                      }
                    </b>
                    <br />

                    Required skill:{" "}
                    <b>
                      {
                        selectedJob.required_skill
                        ?? "—"
                      }
                    </b>
                    <br />

                    Required authority:{" "}
                    <b>
                      {
                        selectedJob.required_authority
                        ?? "—"
                      }
                    </b>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}


      {/* ===================================================
          WORKER RANKING MODAL
          =================================================== */}

      {workerModalOpen
        && (
          <div
            style={{
              position:
                "fixed",

              inset:
                0,

              zIndex:
                5000,

              display:
                "grid",

              placeItems:
                "center",

              padding:
                24,

              background:
                "rgba(5,22,33,.72)",
            }}
          >
            <section
              style={{
                width:
                  "min(920px, 96vw)",

                maxHeight:
                  "88vh",

                overflow:
                  "hidden",

                borderRadius:
                  12,

                background:
                  "#fffdf9",

                boxShadow:
                  "0 25px 70px rgba(0,0,0,.3)",
              }}
            >
              <header
                style={{
                  minHeight:
                    70,

                  display:
                    "flex",

                  alignItems:
                    "center",

                  justifyContent:
                    "space-between",

                  padding:
                    "0 18px",

                  borderBottom:
                    "1px solid #e4d8c8",
                }}
              >
                <div>
                  <span
                    style={{
                      color:
                        "#9b5d20",

                      fontSize:
                        9,

                      fontWeight:
                        900,

                      letterSpacing:
                        ".14em",
                    }}
                  >
                    AI / ML WORKER RANKING
                  </span>

                  <h2
                    style={{
                      margin:
                        "3px 0 0",

                      fontFamily:
                        "Georgia, serif",
                    }}
                  >
                    Eligible Workers
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setWorkerModalOpen(
                      false,
                    )
                  }
                  style={{
                    width:
                      38,

                    height:
                      38,

                    border:
                      0,

                    borderRadius:
                      7,

                    background:
                      "#eef2f3",

                    cursor:
                      "pointer",
                  }}
                >
                  <X
                    size={
                      18
                    }
                  />
                </button>
              </header>

              <div
                style={{
                  padding:
                    14,

                  maxHeight:
                    "calc(88vh - 70px)",

                  overflow:
                    "auto",
                }}
              >
                {selectedJob
                  && (
                    <div
                      style={{
                        marginBottom:
                          12,

                        padding:
                          11,

                        borderRadius:
                          7,

                        background:
                          "#f4efe7",

                        fontSize:
                          11,
                      }}
                    >
                      <strong>
                        {
                          selectedJob
                            .job_code
                        }
                        {" · "}
                        {
                          selectedJob
                            .title
                        }
                      </strong>

                      <span
                        style={{
                          display:
                            "block",

                          marginTop:
                            4,

                          color:
                            "#718087",
                        }}
                      >
                        Required:{" "}
                        {
                          selectedJob
                            .required_skill
                        }
                        {" · "}
                        {
                          selectedJob
                            .required_authority
                        }
                        {" · "}
                        {
                          selectedJob
                            .estimated_minutes
                        }{" "}
                        min
                      </span>
                    </div>
                  )}

                {workerLoading
                  ? (
                    <div
                      style={{
                        padding:
                          30,

                        textAlign:
                          "center",
                      }}
                    >
                      Ranking eligible
                      workers...
                    </div>
                  )
                  : eligibleWorkers.length
                    === 0
                    ? (
                      <div
                        style={{
                          padding:
                            30,

                          textAlign:
                            "center",

                          color:
                            "#738189",
                        }}
                      >
                        No currently
                        eligible workers.
                      </div>
                    )
                    : (
                      <div
                        style={{
                          display:
                            "grid",

                          gap:
                            9,
                        }}
                      >
                        {
                          eligibleWorkers.map(
                            (
                              worker,
                              index,
                            ) => {
                              const id =
                                Number(
                                  worker.worker_id
                                  ??
                                  worker.id,
                                );

                              const code =
                                worker.employee_code
                                ??
                                worker.employee_id
                                ??
                                `WRK-${id}`;

                              const score =
                                percentScore(
                                  worker,
                                );

                              return (
                                <article
                                  key={
                                    `${code}-${id}`
                                  }
                                  style={{
                                    display:
                                      "grid",

                                    gridTemplateColumns:
                                      "54px minmax(0, 1.4fr) repeat(3, minmax(100px,.65fr)) 110px",

                                    gap:
                                      10,

                                    alignItems:
                                      "center",

                                    padding:
                                      12,

                                    border:
                                      index
                                      === 0
                                        ? "2px solid #d89b42"
                                        : "1px solid #e3d8c9",

                                    borderRadius:
                                      8,

                                    background:
                                      index
                                      === 0
                                        ? "#fff7e9"
                                        : "#fff",
                                  }}
                                >
                                  <div
                                    style={{
                                      width:
                                        42,

                                      height:
                                        42,

                                      display:
                                        "grid",

                                      placeItems:
                                        "center",

                                      borderRadius:
                                        99,

                                      background:
                                        index
                                        === 0
                                          ? "#e6a84a"
                                          : "#eaf0f2",

                                      color:
                                        index
                                        === 0
                                          ? "#fff"
                                          : "#22495e",

                                      fontWeight:
                                        900,
                                    }}
                                  >
                                    #
                                    {
                                      index
                                      + 1
                                    }
                                  </div>

                                  <div>
                                    <strong
                                      style={{
                                        display:
                                          "block",

                                        fontSize:
                                          13,
                                      }}
                                    >
                                      {
                                        worker.full_name
                                        ??
                                        worker.name
                                        ??
                                        code
                                      }
                                    </strong>

                                    <span
                                      style={{
                                        display:
                                          "block",

                                        marginTop:
                                          3,

                                        color:
                                          "#65767f",

                                        fontSize:
                                          10,
                                      }}
                                    >
                                      {
                                        code
                                      }
                                      {" · "}
                                      {
                                        worker.designation
                                        ??
                                        "Maintenance Worker"
                                      }
                                    </span>

                                    {index
                                      === 0
                                      && (
                                        <span
                                          style={{
                                            display:
                                              "inline-block",

                                            marginTop:
                                              5,

                                            padding:
                                              "3px 6px",

                                            borderRadius:
                                              4,

                                            background:
                                              "#e6a84a",

                                            color:
                                              "#fff",

                                            fontSize:
                                              8,

                                            fontWeight:
                                              900,
                                          }}
                                        >
                                          AI RECOMMENDED
                                        </span>
                                      )}
                                  </div>

                                  <div>
                                    <small>
                                      ML SUITABILITY
                                    </small>

                                    <strong
                                      style={{
                                        display:
                                          "block",

                                        marginTop:
                                          3,

                                        fontSize:
                                          18,

                                        color:
                                          score
                                          >= 85
                                            ? "#207047"
                                            : "#9c6523",
                                      }}
                                    >
                                      {
                                        score
                                      }%
                                    </strong>
                                  </div>

                                  <div>
                                    <small>
                                      AVAILABILITY
                                    </small>

                                    <strong
                                      style={{
                                        display:
                                          "block",

                                        marginTop:
                                          3,

                                        fontSize:
                                          11,
                                      }}
                                    >
                                      {
                                        worker.availability_status
                                        ??
                                        worker.availability
                                        ??
                                        "AVAILABLE"
                                      }
                                    </strong>
                                  </div>

                                  <div>
                                    <small>
                                      EXPERIENCE
                                    </small>

                                    <strong
                                      style={{
                                        display:
                                          "block",

                                        marginTop:
                                          3,

                                        fontSize:
                                          11,
                                      }}
                                    >
                                      {
                                        worker.years_experience
                                        ?? "—"
                                      } yrs
                                    </strong>
                                  </div>

                                  <button
                                    type="button"
                                    disabled={
                                      assigningWorkerId
                                      !== null
                                    }
                                    onClick={() =>
                                      void assignWorker(
                                        worker,
                                      )
                                    }
                                    style={{
                                      height:
                                        37,

                                      border:
                                        0,

                                      borderRadius:
                                        6,

                                      background:
                                        "#164862",

                                      color:
                                        "#fff",

                                      cursor:
                                        "pointer",

                                      fontSize:
                                        10,

                                      fontWeight:
                                        900,
                                    }}
                                  >
                                    {
                                      assigningWorkerId
                                      === id
                                        ? "Assigning..."
                                        : "Assign"
                                    }
                                  </button>
                                </article>
                              );
                            },
                          )
                        }
                      </div>
                    )}

                {actionMessage
                  && (
                    <div
                      style={{
                        marginTop:
                          12,

                        padding:
                          10,

                        borderRadius:
                          6,

                        background:
                          "#edf5ef",

                        color:
                          "#336d4a",

                        fontSize:
                          11,

                        fontWeight:
                          700,
                      }}
                    >
                      {
                        actionMessage
                      }
                    </div>
                  )}
              </div>
            </section>
          </div>
        )}


      {/* ===================================================
          EXTENSIONS MODAL
          =================================================== */}

      {showExtensions
        && (
          <div
            style={{
              position:
                "fixed",

              inset:
                0,

              zIndex:
                5000,

              display:
                "grid",

              placeItems:
                "center",

              padding:
                24,

              background:
                "rgba(5,22,33,.72)",
            }}
          >
            <section
              style={{
                width:
                  "min(720px, 96vw)",

                maxHeight:
                  "82vh",

                overflow:
                  "hidden",

                borderRadius:
                  12,

                background:
                  "#fffdf9",
              }}
            >
              <header
                style={{
                  minHeight:
                    68,

                  display:
                    "flex",

                  alignItems:
                    "center",

                  justifyContent:
                    "space-between",

                  padding:
                    "0 18px",

                  borderBottom:
                    "1px solid #e4d8c8",
                }}
              >
                <div>
                  <span
                    style={{
                      color:
                        "#9b5d20",

                      fontSize:
                        9,

                      fontWeight:
                        900,
                    }}
                  >
                    WORKER REQUESTS
                  </span>

                  <h2
                    style={{
                      margin:
                        "3px 0 0",

                      fontFamily:
                        "Georgia, serif",
                    }}
                  >
                    Extension Requests
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowExtensions(
                      false,
                    )
                  }
                  style={{
                    width:
                      38,

                    height:
                      38,

                    border:
                      0,

                    borderRadius:
                      7,

                    cursor:
                      "pointer",
                  }}
                >
                  <X
                    size={
                      18
                    }
                  />
                </button>
              </header>

              <div
                style={{
                  padding:
                    14,

                  maxHeight:
                    "calc(82vh - 68px)",

                  overflow:
                    "auto",
                }}
              >
                {
                  extensions.filter(
                    (
                      request,
                    ) =>
                      norm(
                        request.status,
                      )
                      === "PENDING",
                  ).length
                  === 0
                    ? (
                      <div
                        style={{
                          padding:
                            30,

                          textAlign:
                            "center",

                          color:
                            "#718087",
                        }}
                      >
                        No pending extension
                        requests.
                      </div>
                    )
                    : extensions
                      .filter(
                        (
                          request,
                        ) =>
                          norm(
                            request.status,
                          )
                          === "PENDING",
                      )
                      .map(
                        (
                          request,
                        ) => (
                          <article
                            key={
                              request.id
                            }
                            style={{
                              display:
                                "grid",

                              gridTemplateColumns:
                                "1fr auto",

                              gap:
                                12,

                              padding:
                                12,

                              border:
                                "1px solid #e4d8c9",

                              borderRadius:
                                8,

                              marginBottom:
                                9,
                            }}
                          >
                            <div>
                              <strong>
                                {
                                  request.worker_code
                                  ??
                                  request.employee_code
                                  ??
                                  request.worker_name
                                  ??
                                  `Worker ${request.worker_id ?? ""}`
                                }
                                {" · +"}
                                {
                                  request.requested_minutes
                                  ?? 0
                                }{" "}
                                min
                              </strong>

                              <span
                                style={{
                                  display:
                                    "block",

                                  marginTop:
                                    4,

                                  color:
                                    "#6c7c84",

                                  fontSize:
                                    10,
                                }}
                              >
                                {
                                  request.job_code
                                  ??
                                  `Job ${request.maintenance_job_id ?? ""}`
                                }
                                {" · "}
                                {
                                  formatDateTime(
                                    request.requested_at
                                    ??
                                    request.created_at,
                                  )
                                }
                              </span>

                              <p
                                style={{
                                  margin:
                                    "7px 0 0",

                                  fontSize:
                                    11,
                                }}
                              >
                                {
                                  request.reason
                                }
                              </p>
                            </div>

                            <div
                              style={{
                                display:
                                  "flex",

                                gap:
                                  6,

                                alignItems:
                                  "center",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  void decideExtension(
                                    request,
                                    "approve",
                                  )
                                }
                                style={{
                                  height:
                                    34,

                                  border:
                                    0,

                                  borderRadius:
                                    5,

                                  background:
                                    "#26734c",

                                  color:
                                    "#fff",

                                  cursor:
                                    "pointer",

                                  fontWeight:
                                    800,
                                }}
                              >
                                <CheckCircle2
                                  size={
                                    14
                                  }
                                />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void decideExtension(
                                    request,
                                    "reject",
                                  )
                                }
                                style={{
                                  height:
                                    34,

                                  border:
                                    0,

                                  borderRadius:
                                    5,

                                  background:
                                    "#b64236",

                                  color:
                                    "#fff",

                                  cursor:
                                    "pointer",

                                  fontWeight:
                                    800,
                                }}
                              >
                                <X
                                  size={
                                    14
                                  }
                                />
                              </button>
                            </div>
                          </article>
                        ),
                      )
                }

                {actionMessage
                  && (
                    <div
                      style={{
                        padding:
                          10,

                        borderRadius:
                          6,

                        background:
                          "#edf5ef",

                        color:
                          "#336d4a",

                        fontSize:
                          11,
                      }}
                    >
                      {
                        actionMessage
                      }
                    </div>
                  )}
              </div>
            </section>
          </div>
        )}
    </main>
  );
}
