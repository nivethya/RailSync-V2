import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Route as RouteIcon,
  ShieldCheck,
  TrainFront,
  Waypoints,
  Zap,
} from "lucide-react";

import api from "../../services/api";
import OperatorLiveMap from "./OperatorLiveMap";

type Summary = {
  open_disruptions?: number;
  affected_trains?: number;
  recommended_alternatives?: number;
  average_predicted_delay_minutes?: number;
  data_mode?: string;
};

type OperatorProfile = {
  user_id?: number;
  employee_id?: string;
  full_name?: string;
  role?: string;
  zone?: string;
  division?: string;
  control_scope?: string;
  national_access?: boolean;
};

type Disruption = {
  id: number;
  disruption_code?: string;
  status?: string;
  reason?: string;
  severity?: string;
  affected_train_count?: number;
  alternative_count?: number;
  job?: {
    job_code?: string;
    title?: string;
    expected_train_impact?: string | null;
  } | null;
};

type AffectedTrain = {
  id: number;
  disruption_id?: number;
  train_number?: string;
  train_name?: string;
  predicted_delay_minutes?: number | string | null;
  priority_class?: string | null;
};

type Alternative = {
  id: number;
  disruption_id?: number;
  alternative_code?: string;
  title?: string;
  predicted_delay_minutes?: number | string | null;
  conflict_count?: number | null;
  feasibility_score?: number | string | null;
  ml_rank_score?: number | string | null;
  is_feasible?: boolean;
  status?: string;
};

function n(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function norm(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function readArray<T>(
  data: unknown,
  keys: string[],
): T[] {
  if (Array.isArray(data)) return data as T[];
  if (!data || typeof data !== "object") return [];

  const obj = data as Record<string, unknown>;

  for (const key of keys) {
    if (Array.isArray(obj[key])) {
      return obj[key] as T[];
    }
  }

  return [];
}

function formatStatus(value?: string) {
  return String(value ?? "UNKNOWN")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function score(value?: number | string | null) {
  const raw = n(value);
  return Math.round(raw <= 1 ? raw * 100 : raw);
}

function tone(severity?: string) {
  switch (norm(severity)) {
    case "CRITICAL":
      return { bg: "#f8ded9", text: "#a92f25", line: "#c84132" };
    case "HIGH":
      return { bg: "#ffead5", text: "#9d5a1a", line: "#d07a23" };
    case "MEDIUM":
      return { bg: "#fff3c9", text: "#856513", line: "#c49b26" };
    default:
      return { bg: "#e7f1eb", text: "#316c4b", line: "#4d8c68" };
  }
}

export default function OperatorDashboard() {
  const [summary, setSummary] = useState<Summary>({});
  const [operatorProfile, setOperatorProfile] = useState<OperatorProfile>({});
  const [disruptions, setDisruptions] = useState<Disruption[]>([]);
  const [trains, setTrains] = useState<AffectedTrain[]>([]);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectingId, setSelectingId] = useState<number | null>(null);
  const [resolving, setResolving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");

    try {
      const [me, s, d] = await Promise.all([
        api.get("/operator/me"),
        api.get("/operator/summary"),
        api.get("/operator/disruptions"),
      ]);

      setOperatorProfile(me.data ?? {});
      setSummary(s.data ?? {});

      const loadedDisruptions = readArray<Disruption>(
        d.data,
        ["disruptions", "items", "data"],
      ).filter(
        (item) => norm(item.status) !== "RESOLVED",
      );

      setDisruptions(loadedDisruptions);

      setSelectedId((current) => {
        if (
          current
          && loadedDisruptions.some(
            (item) => item.id === current,
          )
        ) {
          return current;
        }

        return loadedDisruptions[0]?.id ?? null;
      });
    } catch (err: any) {
      setError(
        err?.response?.data?.detail
        ?? "Unable to load Train Control operational data.",
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadSelectedEvent = useCallback(
    async (
      disruptionId: number,
      silent = false,
    ) => {
      if (!silent) {
        setError("");
      }

      try {
        const response = await api.get(
          `/operator/disruptions/${disruptionId}`,
        );

        const detailDisruption =
          response?.data?.disruption as
            | Disruption
            | undefined;

        const detailTrains = readArray<AffectedTrain>(
          response.data,
          ["affected_trains", "trains", "items", "data"],
        );

        const detailAlternatives = readArray<Alternative>(
          response.data,
          ["alternatives", "items", "data"],
        );

        setTrains((current) => [
          ...current.filter(
            (item) =>
              item.disruption_id !== disruptionId,
          ),
          ...detailTrains,
        ]);

        setAlternatives((current) => [
          ...current.filter(
            (item) =>
              item.disruption_id !== disruptionId,
          ),
          ...detailAlternatives,
        ]);

        if (detailDisruption) {
          setDisruptions((current) =>
            current.map((item) =>
              item.id === disruptionId
                ? {
                    ...item,
                    ...detailDisruption,
                  }
                : item,
            ),
          );
        }
      } catch (err: any) {
        if (!silent) {
          setError(
            err?.response?.data?.detail
            ?? "Unable to load selected disruption.",
          );
        }
      }
    },
    [],
  );

  useEffect(() => {
    void load();

    // Only lightweight summary + disruption list are polled.
    // Heavy per-event data is loaded only for the selected event.
    const timer = window.setInterval(
      () => void load(true),
      30000,
    );

    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (selectedId == null) {
      return;
    }

    void loadSelectedEvent(selectedId);
  }, [selectedId, loadSelectedEvent]);

  const selectedDisruption = useMemo(
    () =>
      disruptions.find((item) => item.id === selectedId) ?? null,
    [disruptions, selectedId],
  );

  const selectedTrains = useMemo(
    () =>
      trains.filter(
        (item) =>
          selectedId == null
          || item.disruption_id === selectedId,
      ),
    [trains, selectedId],
  );

  const selectedAlternatives = useMemo(
    () =>
      alternatives
        .filter(
          (item) =>
            selectedId == null
            || item.disruption_id === selectedId,
        )
        .sort(
          (a, b) =>
            n(b.ml_rank_score)
            - n(a.ml_rank_score),
        ),
    [alternatives, selectedId],
  );

  async function selectAlternative(
    alternative: Alternative,
  ) {
    if (
      alternative.is_feasible === false
      || selectingId !== null
    ) {
      return;
    }

    setSelectingId(alternative.id);
    setError("");
    setMessage("");

    try {
      const response = await api.post(
        `/operator/alternatives/${alternative.id}/select`,
        {
          note:
            norm(alternative.status) === "SELECTED"
              ? "Selection cleared by Train Control Operator."
              : "Selected by Train Control Operator from RailSync ranked alternatives.",
        },
      );

      setMessage(
        response?.data?.message
        ?? (
          norm(alternative.status) === "SELECTED"
            ? "Operational selection cleared."
            : "Operational alternative selected."
        ),
      );

      if (selectedId !== null) {
        await loadSelectedEvent(
          selectedId,
          true,
        );
      }

      await load(true);
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail;

      setError(
        typeof detail === "string"
          ? detail
          : "Unable to update operational alternative.",
      );
    } finally {
      setSelectingId(null);
    }
  }

  async function resolveSelected() {
    if (
      selectedId == null
      || resolving
    ) {
      return;
    }

    const resolvingId = selectedId;

    setResolving(true);
    setError("");
    setMessage("");

    try {
      const response = await api.post(
        `/operator/disruptions/${resolvingId}/resolve`,
      );

      setMessage(
        response?.data?.message
        ?? "Disruption resolved by Train Control.",
      );

      // Remove the resolved event immediately from the active queue.
      const remaining = disruptions.filter(
        (item) => item.id !== resolvingId,
      );

      setDisruptions(remaining);

      setTrains((current) =>
        current.filter(
          (item) =>
            item.disruption_id !== resolvingId,
        ),
      );

      setAlternatives((current) =>
        current.filter(
          (item) =>
            item.disruption_id !== resolvingId,
        ),
      );

      setSelectedId(
        remaining[0]?.id ?? null,
      );

      await load(true);
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail;

      setError(
        typeof detail === "string"
          ? detail
          : "Unable to resolve disruption.",
      );
    } finally {
      setResolving(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f3eee4",
        color: "#18384a",
      }}
    >
      <header
        style={{
          minHeight: 76,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          background: "#0e2d43",
          color: "#fff",
          borderBottom: "3px solid #d4662b",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <div
            style={{
              width: 45,
              height: 45,
              display: "grid",
              placeItems: "center",
              border: "1px solid rgba(255,255,255,.18)",
              borderRadius: 8,
              background: "rgba(255,255,255,.05)",
            }}
          >
            <TrainFront size={23} />
          </div>

          <div>
            <strong
              style={{
                display: "block",
                fontFamily: "Georgia, serif",
                fontSize: 27,
              }}
            >
              RailSync Train Control
            </strong>

            <span
              style={{
                display: "block",
                color: "#b9cbd5",
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: ".16em",
              }}
            >
              LIVE OPERATIONS VIEW · AI ASSISTED DISRUPTION CONTROL
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div
            style={{
              minWidth: 180,
              padding: "6px 10px",
              border: "1px solid rgba(255,255,255,.14)",
              borderRadius: 6,
              background: "rgba(255,255,255,.06)",
            }}
          >
            <strong
              style={{
                display: "block",
                fontSize: 9,
                color: "#fff",
              }}
            >
              {operatorProfile.full_name ?? "Train Control Operator"}
            </strong>

            <span
              style={{
                display: "block",
                marginTop: 2,
                color: "#b9cbd5",
                fontSize: 8,
                fontWeight: 800,
              }}
            >
              {(operatorProfile.employee_id ?? "TOP")
                + " · "
                + (operatorProfile.control_scope ?? "CONTROL TERRITORY")}
            </span>
          </div>

          <span
            style={{
              padding: "6px 9px",
              border: "1px solid rgba(255,190,106,.35)",
              borderRadius: 5,
              background: "rgba(224,142,45,.13)",
              color: "#ffd18c",
              fontSize: 9,
              fontWeight: 900,
            }}
          >
            {summary.data_mode ?? "DEMO_REPLAY"}
          </span>

          <button
            type="button"
            onClick={() => void load()}
            style={{
              height: 39,
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "0 11px",
              border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 6,
              background: "rgba(255,255,255,.07)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </header>

      <section
        style={{
          maxWidth: 1540,
          margin: "0 auto",
          padding: "18px 22px 34px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "end",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div>
            <span
              style={{
                color: "#9a5c1e",
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: ".15em",
              }}
            >
              NETWORK CONTROL
            </span>

            <h1
              style={{
                margin: "3px 0 4px",
                fontFamily: "Georgia, serif",
                fontSize: 31,
              }}
            >
              Train Operations Dashboard
            </h1>

            <p
              style={{
                margin: 0,
                color: "#6b7d86",
                fontSize: 11,
              }}
            >
              {operatorProfile.national_access
                ? "Pan-India train replay, disruption impact and ranked operating alternatives."
                : `Authorized control territory: ${operatorProfile.control_scope ?? "assigned division"}.`}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "#39704a",
              fontSize: 10,
              fontWeight: 800,
            }}
          >
            <ShieldCheck size={15} />
            Operator retains final authority
          </div>
        </div>

        {(error || message) && (
          <div
            style={{
              marginBottom: 12,
              padding: "10px 12px",
              border: error
                ? "1px solid #e8bbb0"
                : "1px solid #bdd8c5",
              borderRadius: 7,
              background: error ? "#fff0eb" : "#edf6ef",
              color: error ? "#98432d" : "#316b46",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {error || message}
          </div>
        )}

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,minmax(0,1fr))",
            gap: 10,
            marginBottom: 12,
          }}
        >
          {[
            ["OPEN DISRUPTIONS", summary.open_disruptions ?? 0, AlertTriangle],
            ["AFFECTED TRAINS", summary.affected_trains ?? 0, TrainFront],
            ["AI RECOMMENDATIONS", summary.recommended_alternatives ?? 0, Zap],
            [
              "AVG PREDICTED DELAY",
              `${summary.average_predicted_delay_minutes ?? 0} min`,
              Clock3,
            ],
          ].map(([label, value, Icon]) => {
            const CardIcon = Icon as typeof AlertTriangle;

            return (
              <article
                key={String(label)}
                style={{
                  minHeight: 78,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  border: "1px solid #ddd0bf",
                  borderRadius: 9,
                  background: "#fffdf9",
                }}
              >
                <CardIcon size={17} />
                <div>
                  <span
                    style={{
                      display: "block",
                      color: "#788890",
                      fontSize: 8,
                      fontWeight: 900,
                    }}
                  >
                    {label as string}
                  </span>

                  <strong
                    style={{
                      display: "block",
                      marginTop: 3,
                      fontFamily: "Georgia, serif",
                      fontSize: 23,
                    }}
                  >
                    {value as string | number}
                  </strong>
                </div>
              </article>
            );
          })}
        </section>

        <article
          style={{
            marginBottom: 12,
            overflow: "hidden",
            border: "1px solid #ddd0bf",
            borderRadius: 9,
            background: "#fffdf9",
          }}
        >
          <div
            style={{
              minHeight: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 13px",
              borderBottom: "1px solid #e7dccf",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Waypoints size={17} />

              <div>
                <span
                  style={{
                    display: "block",
                    color: "#9a5c1e",
                    fontSize: 8,
                    fontWeight: 900,
                  }}
                >
                  NETWORK REPLAY
                </span>

                <strong>Moving Train Operations Map</strong>
              </div>
            </div>

            <span
              style={{
                color: "#5c7581",
                fontSize: 9,
                fontWeight: 800,
              }}
            >
              {selectedTrains.length} trains in selected event
            </span>
          </div>

          <OperatorLiveMap
            trains={trains}
            selectedDisruptionId={selectedId}
          />
        </article>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(300px,.72fr) minmax(0,1.35fr)",
            gap: 12,
          }}
        >
          <article
            style={{
              border: "1px solid #ddd0bf",
              borderRadius: 9,
              background: "#fffdf9",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                minHeight: 54,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "0 12px",
                borderBottom: "1px solid #e7dccf",
              }}
            >
              <AlertTriangle size={16} />
              <strong>Disruption Queue</strong>
            </div>

            <div style={{ maxHeight: 410, overflowY: "auto" }}>
              {loading ? (
                <div style={{ padding: 30, textAlign: "center" }}>
                  Loading...
                </div>
              ) : disruptions.length === 0 ? (
                <div
                  style={{
                    padding: 30,
                    textAlign: "center",
                    color: "#71818a",
                  }}
                >
                  No disruption events.
                </div>
              ) : (
                disruptions.map((item) => {
                  const t = tone(item.severity);
                  const selected = item.id === selectedId;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      style={{
                        width: "100%",
                        display: "block",
                        padding: 12,
                        border: 0,
                        borderBottom: "1px solid #eee4d7",
                        borderLeft: `4px solid ${t.line}`,
                        background: selected ? "#f2eee7" : "#fffdf9",
                        color: "#18384a",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <strong style={{ fontSize: 11 }}>
                          {item.disruption_code ?? `DSP-${item.id}`}
                        </strong>

                        <span
                          style={{
                            padding: "3px 6px",
                            borderRadius: 4,
                            background: t.bg,
                            color: t.text,
                            fontSize: 8,
                            fontWeight: 900,
                          }}
                        >
                          {item.severity ?? "—"}
                        </span>
                      </div>

                      <span
                        style={{
                          display: "block",
                          marginTop: 5,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {item.job?.title ?? item.reason ?? "Railway disruption"}
                      </span>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginTop: 7,
                          color: "#71818a",
                          fontSize: 9,
                        }}
                      >
                        <span>{formatStatus(item.status)}</span>
                        <span>{item.affected_train_count ?? 0} trains</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </article>

          <div style={{ display: "grid", gap: 12 }}>
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) minmax(0,1.15fr)",
                gap: 12,
              }}
            >
              <article
                style={{
                  border: "1px solid #ddd0bf",
                  borderRadius: 9,
                  background: "#fffdf9",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    minHeight: 52,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "0 12px",
                    borderBottom: "1px solid #e7dccf",
                  }}
                >
                  <TrainFront size={16} />
                  <strong>Affected Trains</strong>
                </div>

                <div style={{ maxHeight: 330, overflowY: "auto" }}>
                  {selectedTrains.length === 0 ? (
                    <div
                      style={{
                        padding: 25,
                        textAlign: "center",
                        color: "#71818a",
                        fontSize: 10,
                      }}
                    >
                      No affected trains.
                    </div>
                  ) : (
                    selectedTrains.map((train) => (
                      <div
                        key={train.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(0,1fr) 72px",
                          gap: 8,
                          padding: 11,
                          borderBottom: "1px solid #eee5d9",
                        }}
                      >
                        <div>
                          <strong
                            style={{
                              display: "block",
                              fontSize: 11,
                            }}
                          >
                            {train.train_number ?? `TRAIN-${train.id}`}
                          </strong>

                          <span
                            style={{
                              display: "block",
                              marginTop: 3,
                              color: "#6e7e86",
                              fontSize: 9,
                            }}
                          >
                            {train.train_name ?? train.priority_class ?? "Service"}
                          </span>
                        </div>

                        <strong
                          style={{
                            color:
                              n(train.predicted_delay_minutes) >= 30
                                ? "#b23b2e"
                                : "#9a6a21",
                            fontSize: 11,
                            textAlign: "right",
                          }}
                        >
                          +{Math.round(n(train.predicted_delay_minutes))}m
                        </strong>
                      </div>
                    ))
                  )}
                </div>
              </article>

              <article
                style={{
                  border: "1px solid #ddd0bf",
                  borderRadius: 9,
                  background: "#fffdf9",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    minHeight: 52,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "0 12px",
                    borderBottom: "1px solid #e7dccf",
                  }}
                >
                  <RouteIcon size={16} />
                  <strong>AI-Ranked Alternatives</strong>
                </div>

                <div style={{ maxHeight: 330, overflowY: "auto" }}>
                  {selectedAlternatives.length === 0 ? (
                    <div
                      style={{
                        padding: 25,
                        textAlign: "center",
                        color: "#71818a",
                        fontSize: 10,
                      }}
                    >
                      No alternatives.
                    </div>
                  ) : (
                    selectedAlternatives.map((alternative, index) => {
                      const selected =
                        norm(alternative.status) === "SELECTED";

                      const feasible =
                        alternative.is_feasible !== false;

                      return (
                        <div
                          key={alternative.id}
                          style={{
                            padding: 11,
                            borderBottom: "1px solid #eee5d9",
                            background: selected ? "#edf5ef" : "#fffdf9",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 8,
                            }}
                          >
                            <div>
                              <span
                                style={{
                                  display: "block",
                                  color: "#9a5c1e",
                                  fontSize: 8,
                                  fontWeight: 900,
                                }}
                              >
                                AI RANK #{index + 1}
                              </span>

                              <strong
                                style={{
                                  display: "block",
                                  marginTop: 2,
                                  fontSize: 11,
                                }}
                              >
                                {alternative.title
                                  ?? alternative.alternative_code
                                  ?? "Operational alternative"}
                              </strong>
                            </div>

                            <strong style={{ fontSize: 13 }}>
                              {score(alternative.ml_rank_score)}%
                            </strong>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              marginTop: 6,
                              color: "#6e7e86",
                              fontSize: 8,
                            }}
                          >
                            <span>
                              Delay {Math.round(n(alternative.predicted_delay_minutes))}m
                            </span>
                            <span>
                              Conflicts {alternative.conflict_count ?? 0}
                            </span>
                            <span>
                              Feasible {score(alternative.feasibility_score)}%
                            </span>
                          </div>

                          <button
                            type="button"
                            disabled={
                              !feasible
                              || selectingId !== null
                            }
                            onClick={() => void selectAlternative(alternative)}
                            style={{
                              width: "100%",
                              minHeight: 34,
                              marginTop: 8,
                              border: 0,
                              borderRadius: 5,
                              background: selected
                                ? "#39704a"
                                : feasible
                                  ? "#174a65"
                                  : "#c7cbcb",
                              color: "#fff",
                              cursor:
                                feasible
                                  ? "pointer"
                                  : "default",
                              fontWeight: 900,
                              fontSize: 9,
                            }}
                          >
                            {selectingId === alternative.id
                              ? (
                                  selected
                                    ? "UNDOING..."
                                    : "SELECTING..."
                                )
                              : selected
                                ? "UNDO SELECTION"
                                : feasible
                                  ? "SELECT ACTION"
                                  : "INFEASIBLE"}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </article>
            </section>

            <article
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12,
                alignItems: "center",
                padding: 12,
                border: "1px solid #ddd0bf",
                borderRadius: 9,
                background: "#fffdf9",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <BarChart3 size={18} />

                <div>
                  <strong
                    style={{
                      display: "block",
                      fontSize: 11,
                    }}
                  >
                    Human-in-the-loop control
                  </strong>

                  <span
                    style={{
                      display: "block",
                      marginTop: 3,
                      color: "#6e7e86",
                      fontSize: 9,
                    }}
                  >
                    AI ranks feasible actions. Train Control makes the final decision.
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={
                  !selectedDisruption
                  || resolving
                  || norm(selectedDisruption.status) === "RESOLVED"
                }
                onClick={() => void resolveSelected()}
                style={{
                  minHeight: 38,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "0 12px",
                  border: 0,
                  borderRadius: 6,
                  background:
                    selectedDisruption
                    && norm(selectedDisruption.status) !== "RESOLVED"
                      ? "#39704a"
                      : "#c9cecb",
                  color: "#fff",
                  cursor:
                    selectedDisruption
                    && !resolving
                    && norm(selectedDisruption.status) !== "RESOLVED"
                      ? "pointer"
                      : "default",
                  fontWeight: 900,
                  fontSize: 9,
                }}
              >
                <CheckCircle2 size={14} />
                {resolving ? "RESOLVING..." : "RESOLVE EVENT"}
              </button>
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}
