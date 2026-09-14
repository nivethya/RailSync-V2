import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertTriangle,
  ArrowLeftRight,
  Clock3,
  Gauge,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  TrainFront,
  Wrench,
  Zap,
} from "lucide-react";


type TrainKind =
  | "LOCAL"
  | "EXPRESS"
  | "SUPERFAST";

type SimTrain = {
  id: number;
  number: string;
  name: string;
  kind: TrainKind;
  track: number;
  direction: 1 | -1;
  progress: number;
  speed: number;
  baseDelay: number;
};

type DecisionCode =
  | "PLATFORM_SWAP"
  | "SPEED_REGULATION"
  | "HOLD_APPROACH"
  | "REROUTE_CROSSOVER";

type Decision = {
  code: DecisionCode;
  title: string;
  description: string;
  predictedDelay: number;
  conflicts: number;
  feasibility: number;
  score: number;
  recommended?: boolean;
};


const TRACKS = [
  {
    id: 1,
    label: "UP SUBURBAN",
    platform: "Platform 1",
    usage: "Local / MEMU",
  },
  {
    id: 2,
    label: "UP FAST",
    platform: "Platform 2",
    usage: "Fast Local",
  },
  {
    id: 3,
    label: "DOWN SUBURBAN",
    platform: "Platform 3",
    usage: "Local / MEMU",
  },
  {
    id: 4,
    label: "DOWN FAST",
    platform: "Platform 4",
    usage: "Express / Superfast",
  },
  {
    id: 5,
    label: "THROUGH UP",
    platform: "Platform 5",
    usage: "Express",
  },
  {
    id: 6,
    label: "THROUGH DOWN",
    platform: "Platform 6",
    usage: "Express",
  },
];


const ORIGINAL_TRAINS: SimTrain[] = [
  {
    id: 1,
    number: "MSB-TBM-401",
    name: "Chennai Beach – Tambaram Local",
    kind: "LOCAL",
    track: 1,
    direction: 1,
    progress: 7,
    speed: 0.46,
    baseDelay: 1,
  },
  {
    id: 2,
    number: "TBM-CGL-217",
    name: "Tambaram – Chengalpattu Local",
    kind: "LOCAL",
    track: 3,
    direction: 1,
    progress: 19,
    speed: 0.42,
    baseDelay: 0,
  },
  {
    id: 3,
    number: "MSB-TBM-409",
    name: "Chennai Beach – Tambaram Local",
    kind: "LOCAL",
    track: 1,
    direction: 1,
    progress: 39,
    speed: 0.45,
    baseDelay: 2,
  },
  {
    id: 4,
    number: "TBM-MSB-414",
    name: "Tambaram – Chennai Beach Local",
    kind: "LOCAL",
    track: 3,
    direction: -1,
    progress: 82,
    speed: 0.43,
    baseDelay: 1,
  },
  {
    id: 5,
    number: "12635",
    name: "Vaigai Superfast Express",
    kind: "SUPERFAST",
    track: 4,
    direction: 1,
    progress: 20,
    speed: 0.67,
    baseDelay: 4,
  },
  {
    id: 6,
    number: "12653",
    name: "Rockfort Express",
    kind: "EXPRESS",
    track: 6,
    direction: -1,
    progress: 78,
    speed: 0.61,
    baseDelay: 3,
  },
  {
    id: 7,
    number: "16127",
    name: "Guruvayur Express",
    kind: "EXPRESS",
    track: 5,
    direction: 1,
    progress: 13,
    speed: 0.58,
    baseDelay: 2,
  },
  {
    id: 8,
    number: "MSB-TBM-421",
    name: "Chennai Beach – Tambaram Local",
    kind: "LOCAL",
    track: 2,
    direction: 1,
    progress: 57,
    speed: 0.48,
    baseDelay: 1,
  },
  {
    id: 9,
    number: "CGL-TBM-224",
    name: "Chengalpattu – Tambaram Local",
    kind: "LOCAL",
    track: 3,
    direction: -1,
    progress: 68,
    speed: 0.41,
    baseDelay: 0,
  },
  {
    id: 10,
    number: "20691",
    name: "Tambaram – Nagercoil Antyodaya",
    kind: "EXPRESS",
    track: 4,
    direction: 1,
    progress: 35,
    speed: 0.59,
    baseDelay: 6,
  },
  {
    id: 11,
    number: "MSB-TBM-429",
    name: "Chennai Beach – Tambaram Local",
    kind: "LOCAL",
    track: 2,
    direction: 1,
    progress: 11,
    speed: 0.47,
    baseDelay: 0,
  },
  {
    id: 12,
    number: "12693",
    name: "Pearl City Express",
    kind: "SUPERFAST",
    track: 6,
    direction: -1,
    progress: 52,
    speed: 0.65,
    baseDelay: 5,
  },
  {
    id: 13,
    number: "TBM-CGL-231",
    name: "Tambaram – Chengalpattu Local",
    kind: "LOCAL",
    track: 1,
    direction: 1,
    progress: 72,
    speed: 0.44,
    baseDelay: 1,
  },
  {
    id: 14,
    number: "CGL-MSB-238",
    name: "Chengalpattu – Chennai Beach Local",
    kind: "LOCAL",
    track: 3,
    direction: -1,
    progress: 31,
    speed: 0.42,
    baseDelay: 2,
  },
];


const DECISIONS: Decision[] = [
  {
    code: "PLATFORM_SWAP",
    title: "Shift express traffic to Platform 5",
    description:
      "Move affected DOWN-fast trains through the available through-line and keep suburban traffic unchanged.",
    predictedDelay: 7,
    conflicts: 1,
    feasibility: 94,
    score: 93,
    recommended: true,
  },
  {
    code: "REROUTE_CROSSOVER",
    title: "Use crossover before Tambaram throat",
    description:
      "Cross affected trains from DOWN FAST to THROUGH DOWN before the maintenance block.",
    predictedDelay: 9,
    conflicts: 2,
    feasibility: 89,
    score: 88,
  },
  {
    code: "SPEED_REGULATION",
    title: "Apply temporary speed regulation",
    description:
      "Sequence approaching trains at reduced speed to avoid simultaneous occupation near the blocked section.",
    predictedDelay: 13,
    conflicts: 3,
    feasibility: 97,
    score: 81,
  },
  {
    code: "HOLD_APPROACH",
    title: "Hold approaching express before block",
    description:
      "Keep the route unchanged and hold affected services before entering the Tambaram station throat.",
    predictedDelay: 21,
    conflicts: 0,
    feasibility: 100,
    score: 68,
  },
];


function cloneTrains() {
  return ORIGINAL_TRAINS.map(
    (train) => ({
      ...train,
    }),
  );
}


function kindClass(
  kind: TrainKind,
) {
  if (kind === "SUPERFAST") {
    return "sim-train superfast";
  }

  if (kind === "EXPRESS") {
    return "sim-train express";
  }

  return "sim-train local";
}



export default function OperatorSimulation() {
  const [
    trains,
    setTrains,
  ] = useState<SimTrain[]>(
    cloneTrains,
  );

  const [
    running,
    setRunning,
  ] = useState(true);

  const [
    timeScale,
    setTimeScale,
  ] = useState(5);

  const [
    elapsedMinutes,
    setElapsedMinutes,
  ] = useState(0);

  const [
    selectedDecision,
    setSelectedDecision,
  ] = useState<DecisionCode | null>(
    null,
  );

  const [
    faultActive,
    setFaultActive,
  ] = useState(true);

  const [
    eventLog,
    setEventLog,
  ] = useState<string[]>([
    "T+00:00  DEMO_REPLAY scenario initialized.",
    "T+00:00  Track 4 DOWN FAST maintenance fault active at KM 27.4.",
    "T+00:00  AI evaluated four conflict-resolution alternatives.",
  ]);

  const clockAccumulator =
    useRef(0);


  const decision =
    useMemo(
      () =>
        DECISIONS.find(
          (item) =>
            item.code
            === selectedDecision,
        ) ?? null,
      [selectedDecision],
    );


  const beforeDelay =
    faultActive
      ? 28
      : 4;

  const afterDelay =
    faultActive
      ? (
          decision
            ?.predictedDelay
          ?? 28
        )
      : 4;

  const currentConflicts =
    faultActive
      ? (
          decision
            ?.conflicts
          ?? 5
        )
      : 0;


  useEffect(() => {
    if (!running) {
      return;
    }

    const timer =
      window.setInterval(
        () => {
          const multiplier =
            timeScale;

          setTrains(
            (current) =>
              current.map(
                (train) => {
                  let track =
                    train.track;

                  let speed =
                    train.speed;

                  let blocked = false;

                  const approachingFault =
                    train.track === 4
                    &&
                    train.direction === 1
                    &&
                    train.progress >= 39
                    &&
                    train.progress <= 64;

                  if (
                    faultActive
                    &&
                    approachingFault
                  ) {
                    if (
                      selectedDecision
                      === "PLATFORM_SWAP"
                    ) {
                      track = 5;
                    } else if (
                      selectedDecision
                      === "REROUTE_CROSSOVER"
                    ) {
                      track = 6;
                    } else if (
                      selectedDecision
                      === "SPEED_REGULATION"
                    ) {
                      speed *= 0.36;
                    } else {
                      blocked = true;
                    }
                  }

                  if (
                    faultActive
                    &&
                    selectedDecision
                    === "HOLD_APPROACH"
                    &&
                    train.track === 4
                    &&
                    train.direction === 1
                    &&
                    train.progress >= 33
                    &&
                    train.progress < 41
                  ) {
                    blocked = true;
                  }

                  let next =
                    train.progress;

                  if (!blocked) {
                    next +=
                      train.direction
                      * speed
                      * multiplier
                      * 0.18;
                  }

                  if (next > 103) {
                    next = -3;
                    track =
                      train.track;
                  }

                  if (next < -3) {
                    next = 103;
                    track =
                      train.track;
                  }

                  return {
                    ...train,
                    track,
                    progress: next,
                  };
                },
              ),
          );

          clockAccumulator.current +=
            multiplier;

          if (
            clockAccumulator.current
            >= 10
          ) {
            const addMinutes =
              Math.floor(
                clockAccumulator.current
                / 10,
              );

            clockAccumulator.current %=
              10;

            setElapsedMinutes(
              (value) =>
                value + addMinutes,
            );
          }
        },
        450,
      );

    return () =>
      window.clearInterval(
        timer,
      );
  }, [
    running,
    timeScale,
    faultActive,
    selectedDecision,
  ]);


  function applyDecision(
    item: Decision,
  ) {
    setSelectedDecision(
      item.code,
    );

    setEventLog(
      (logs) => [
        `T+${String(elapsedMinutes).padStart(2, "0")}:00  OPERATOR selected: ${item.title}.`,
        `T+${String(elapsedMinutes).padStart(2, "0")}:00  Predicted network delay reduced from 28 min to ${item.predictedDelay} min.`,
        ...logs,
      ].slice(0, 8),
    );
  }


  function resetSimulation() {
    setTrains(
      cloneTrains(),
    );

    setElapsedMinutes(0);
    setSelectedDecision(null);
    setFaultActive(true);
    setRunning(true);

    clockAccumulator.current = 0;

    setEventLog([
      "T+00:00  DEMO_REPLAY scenario initialized.",
      "T+00:00  Track 4 DOWN FAST maintenance fault active at KM 27.4.",
      "T+00:00  AI evaluated four conflict-resolution alternatives.",
    ]);
  }


  function clearFault() {
    setFaultActive(false);

    setEventLog(
      (logs) => [
        `T+${String(elapsedMinutes).padStart(2, "0")}:00  Maintenance block cleared. Normal routing restored.`,
        ...logs,
      ].slice(0, 8),
    );
  }


  return (
    <div className="simulation-page">
      <style>
        {styles}
      </style>

      <header className="simulation-header">
        <div>
          <div className="eyebrow">
            RAILSYNC CONTROL LAB · DEMO_REPLAY
          </div>

          <h1>
            Tambaram Live What-If Simulation
          </h1>

          <p>
            Multi-track local and express operations, maintenance conflict,
            predicted delay and operator-controlled alternatives.
          </p>
        </div>

        <div className="header-actions">
          <button
            className="ghost-button"
            onClick={() =>
              setRunning(
                (value) =>
                  !value,
              )
            }
          >
            {
              running
                ? <Pause size={16} />
                : <Play size={16} />
            }
            {
              running
                ? "Pause"
                : "Resume"
            }
          </button>

          <button
            className="ghost-button"
            onClick={
              resetSimulation
            }
          >
            <RefreshCw size={16} />
            Reset
          </button>
        </div>
      </header>

      <section className="metric-grid">
        <div className="metric-card">
          <TrainFront size={18} />
          <span>
            ACTIVE TRAINS
          </span>
          <strong>
            {trains.length}
          </strong>
          <small>
            local + express
          </small>
        </div>

        <div className="metric-card danger">
          <ShieldAlert size={18} />
          <span>
            OPEN CONFLICTS
          </span>
          <strong>
            {currentConflicts}
          </strong>
          <small>
            Tambaram throat
          </small>
        </div>

        <div className="metric-card">
          <Clock3 size={18} />
          <span>
            DELAY BEFORE
          </span>
          <strong>
            {beforeDelay} min
          </strong>
          <small>
            no intervention
          </small>
        </div>

        <div className="metric-card good">
          <Zap size={18} />
          <span>
            DELAY AFTER
          </span>
          <strong>
            {afterDelay} min
          </strong>
          <small>
            selected action
          </small>
        </div>

        <div className="metric-card">
          <Gauge size={18} />
          <span>
            TIME SCALE
          </span>
          <strong>
            {timeScale}×
          </strong>
          <small>
            T+{elapsedMinutes} min
          </small>
        </div>
      </section>

      <section className="control-strip">
        <div>
          <strong>
            Simulation speed
          </strong>

          {[1, 5, 10].map(
            (scale) => (
              <button
                key={scale}
                className={
                  timeScale
                  === scale
                    ? "scale active"
                    : "scale"
                }
                onClick={() =>
                  setTimeScale(
                    scale,
                  )
                }
              >
                {scale}×
              </button>
            ),
          )}
        </div>

        <div className="fault-status">
          <AlertTriangle size={16} />

          <span>
            {
              faultActive
                ? "FAULT ACTIVE · DOWN FAST / PLATFORM 4"
                : "FAULT CLEARED · NORMAL OPERATIONS"
            }
          </span>

          {
            faultActive
            && (
              <button
                onClick={
                  clearFault
                }
              >
                Mark maintenance complete
              </button>
            )
          }
        </div>
      </section>

      <section className="rail-panel">
        <div className="station-head">
          <div>
            <span>
              CHENNAI SIDE
            </span>
            <b>
              ← TAMBARAM JUNCTION →
            </b>
            <span>
              CHENGALPATTU SIDE
            </span>
          </div>
        </div>

        <div className="track-board">
          <div className="station-building">
            <div>
              TBM
            </div>
            <small>
              TAMBARAM
            </small>
          </div>

          <div className="crossover crossover-a" />
          <div className="crossover crossover-b" />

          {TRACKS.map(
            (track) => (
              <div
                className="track-row"
                key={
                  track.id
                }
              >
                <div className="track-label">
                  <strong>
                    T{track.id}
                  </strong>

                  <span>
                    {track.label}
                  </span>

                  <small>
                    {track.platform}
                  </small>
                </div>

                <div
                  className={
                    faultActive
                    && track.id === 4
                      ? "rail-line blocked"
                      : "rail-line"
                  }
                >
                  <div className="rail-top" />
                  <div className="rail-bottom" />

                  {
                    Array.from(
                      { length: 33 },
                    ).map(
                      (_, index) => (
                        <i
                          key={
                            index
                          }
                          style={{
                            left: `${
                              index
                              * 3.1
                            }%`,
                          }}
                        />
                      ),
                    )
                  }

                  <div className="platform-zone">
                    <span>
                      {
                        track.platform
                      }
                    </span>
                  </div>

                  {
                    faultActive
                    && track.id
                    === 4
                    && (
                      <div className="fault-zone">
                        <Wrench size={15} />

                        <b>
                          BLOCKED
                        </b>

                        <small>
                          OHE INSULATOR · KM 27.4
                        </small>
                      </div>
                    )
                  }

                  {
                    trains
                      .filter(
                        (train) =>
                          train.track
                          === track.id,
                      )
                      .map(
                        (train) => (
                          <div
                            key={
                              train.id
                            }
                            className={
                              kindClass(
                                train.kind,
                              )
                            }
                            style={{
                              left: `${
                                train.progress
                              }%`,
                            }}
                            title={`${train.number} · ${train.name}`}
                          >
                            <TrainFront
                              size={13}
                            />

                            <span>
                              {
                                train.number
                              }
                            </span>
                          </div>
                        ),
                      )
                  }
                </div>

                <div className="track-direction">
                  <b>
                    {
                      track.usage
                    }
                  </b>
                </div>
              </div>
            ),
          )}
        </div>

        <div className="legend">
          <span>
            <i className="dot local" />
            Local
          </span>

          <span>
            <i className="dot express" />
            Express
          </span>

          <span>
            <i className="dot superfast" />
            Superfast
          </span>

          <span>
            <i className="fault-box" />
            Maintenance block
          </span>

          <span>
            <ArrowLeftRight size={14} />
            crossover available
          </span>
        </div>
      </section>

      <section className="lower-grid">
        <div className="decision-panel">
          <div className="panel-heading">
            <div>
              <span>
                AI / ML DECISION SUPPORT
              </span>

              <h2>
                Alternate Possibilities
              </h2>
            </div>

            <div className="recommendation-pill">
              RECOMMENDED · PLATFORM SWAP
            </div>
          </div>

          <div className="decision-list">
            {
              DECISIONS.map(
                (item) => {
                  const selected =
                    selectedDecision
                    === item.code;

                  return (
                    <button
                      key={
                        item.code
                      }
                      className={
                        selected
                          ? "decision-card selected"
                          : item.recommended
                          ? "decision-card recommended"
                          : "decision-card"
                      }
                      onClick={() =>
                        applyDecision(
                          item,
                        )
                      }
                    >
                      <div className="decision-rank">
                        <span>
                          AI SCORE
                        </span>

                        <strong>
                          {item.score}%
                        </strong>
                      </div>

                      <div className="decision-copy">
                        <h3>
                          {
                            item.title
                          }
                        </h3>

                        <p>
                          {
                            item.description
                          }
                        </p>

                        <div>
                          <span>
                            Delay{" "}
                            <b>
                              {
                                item.predictedDelay
                              }
                              m
                            </b>
                          </span>

                          <span>
                            Conflicts{" "}
                            <b>
                              {
                                item.conflicts
                              }
                            </b>
                          </span>

                          <span>
                            Feasible{" "}
                            <b>
                              {
                                item.feasibility
                              }
                              %
                            </b>
                          </span>
                        </div>
                      </div>

                      <span className="select-indicator">
                        {
                          selected
                            ? "SELECTED"
                            : "CHOOSE"
                        }
                      </span>
                    </button>
                  );
                },
              )
            }
          </div>
        </div>

        <div className="side-panel">
          <div className="panel-heading compact">
            <div>
              <span>
                LIVE EVENT LOG
              </span>

              <h2>
                Control Timeline
              </h2>
            </div>
          </div>

          <div className="event-log">
            {
              eventLog.map(
                (
                  event,
                  index,
                ) => (
                  <div
                    key={
                      `${event}-${index}`
                    }
                  >
                    <i />

                    <span>
                      {event}
                    </span>
                  </div>
                ),
              )
            }
          </div>

          <div className="decision-result">
            <span>
              CURRENT OPERATOR DECISION
            </span>

            <strong>
              {
                decision
                  ?.title
                ??
                "Awaiting operator input"
              }
            </strong>

            <p>
              {
                decision
                  ? `Predicted reduction: ${beforeDelay - afterDelay} minutes. Human operator remains final authority.`
                  : "RailSync recommends Platform Swap, but no movement plan is executed until the operator chooses an action."
              }
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}


const styles = `
  .simulation-page {
    min-height: 100vh;
    padding: 24px;
    background:
      radial-gradient(circle at 15% 0%, rgba(198,151,73,.12), transparent 32%),
      #f4efe4;
    color: #102d40;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .simulation-header {
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:20px;
    max-width:1600px;
    margin:0 auto 18px;
  }

  .eyebrow,
  .panel-heading span {
    color:#9e681d;
    font-size:10px;
    font-weight:900;
    letter-spacing:.11em;
  }

  .simulation-header h1 {
    margin:5px 0 4px;
    font-family: Georgia, serif;
    font-size:30px;
    color:#0d2b40;
  }

  .simulation-header p {
    margin:0;
    color:#667681;
    font-size:13px;
  }

  .header-actions {
    display:flex;
    gap:8px;
  }

  .ghost-button {
    display:flex;
    align-items:center;
    gap:7px;
    border:1px solid #cfc3b1;
    background:#fffaf2;
    color:#173d51;
    padding:9px 12px;
    border-radius:8px;
    cursor:pointer;
    font-weight:800;
  }

  .metric-grid {
    max-width:1600px;
    margin:0 auto 14px;
    display:grid;
    grid-template-columns:repeat(5, 1fr);
    gap:10px;
  }

  .metric-card {
    position:relative;
    min-height:100px;
    border:1px solid #d9cfbf;
    border-radius:10px;
    background:#fffaf3;
    padding:14px 14px 12px;
    box-shadow:0 3px 12px rgba(55,42,25,.04);
  }

  .metric-card svg {
    position:absolute;
    right:13px;
    top:13px;
    opacity:.65;
  }

  .metric-card span {
    display:block;
    font-size:9px;
    font-weight:900;
    color:#72808a;
    letter-spacing:.07em;
  }

  .metric-card strong {
    display:block;
    margin-top:6px;
    font-family:Georgia, serif;
    font-size:26px;
  }

  .metric-card small {
    color:#82909a;
  }

  .metric-card.danger {
    border-left:4px solid #c84b3d;
  }

  .metric-card.good {
    border-left:4px solid #33865b;
  }

  .control-strip {
    max-width:1600px;
    margin:0 auto 12px;
    padding:10px 12px;
    background:#0e3043;
    color:white;
    border-radius:9px;
    display:flex;
    justify-content:space-between;
    align-items:center;
    gap:15px;
  }

  .control-strip > div {
    display:flex;
    align-items:center;
    gap:8px;
  }

  .control-strip strong {
    margin-right:7px;
    font-size:11px;
  }

  .scale {
    border:1px solid rgba(255,255,255,.28);
    background:transparent;
    color:white;
    border-radius:5px;
    padding:5px 9px;
    font-weight:900;
    cursor:pointer;
  }

  .scale.active {
    background:#d69d43;
    color:#172d38;
    border-color:#d69d43;
  }

  .fault-status {
    font-size:10px;
    font-weight:900;
  }

  .fault-status button {
    border:0;
    border-radius:5px;
    background:#f2efe7;
    color:#17384a;
    padding:6px 9px;
    font-size:9px;
    font-weight:900;
    cursor:pointer;
  }

  .rail-panel {
    position:relative;
    max-width:1600px;
    margin:0 auto;
    border:1px solid #d9cfbf;
    border-radius:11px;
    background:
      linear-gradient(rgba(255,255,255,.66), rgba(255,255,255,.66)),
      repeating-linear-gradient(90deg, #d5c7b2 0, #d5c7b2 1px, transparent 1px, transparent 42px);
    overflow:hidden;
  }

  .station-head {
    background:#fbf6ec;
    border-bottom:1px solid #ddd0bc;
    padding:9px 18px;
  }

  .station-head > div {
    display:grid;
    grid-template-columns:1fr 1fr 1fr;
    align-items:center;
    font-size:9px;
    font-weight:900;
    color:#71808a;
  }

  .station-head b {
    text-align:center;
    color:#17384b;
    letter-spacing:.08em;
  }

  .station-head span:last-child {
    text-align:right;
  }

  .track-board {
    position:relative;
    padding:21px 15px 18px;
  }

  .track-row {
    display:grid;
    grid-template-columns:145px 1fr 115px;
    align-items:center;
    gap:10px;
    min-height:63px;
    position:relative;
  }

  .track-label {
    padding-right:10px;
    text-align:right;
  }

  .track-label strong {
    display:inline-block;
    color:#fff;
    background:#173e52;
    border-radius:4px;
    padding:3px 5px;
    font-size:9px;
    margin-right:5px;
  }

  .track-label span {
    font-size:9px;
    font-weight:900;
  }

  .track-label small {
    display:block;
    margin-top:3px;
    color:#89939a;
    font-size:8px;
  }

  .track-direction {
    font-size:8px;
    color:#71818a;
  }

  .rail-line {
    position:relative;
    height:50px;
    overflow:visible;
  }

  .rail-top,
  .rail-bottom {
    position:absolute;
    left:0;
    right:0;
    height:3px;
    background:#435c67;
    box-shadow:0 0 0 1px #a8a092;
  }

  .rail-top {
    top:19px;
  }

  .rail-bottom {
    top:31px;
  }

  .rail-line i {
    position:absolute;
    top:17px;
    width:2px;
    height:19px;
    background:#7a6854;
    transform:rotate(4deg);
  }

  .platform-zone {
    position:absolute;
    left:43%;
    top:6px;
    width:14%;
    height:38px;
    border-radius:4px;
    background:#d4c7ad;
    border:1px solid #bbaa8d;
    display:grid;
    place-items:center;
    z-index:1;
  }

  .platform-zone span {
    font-size:8px;
    font-weight:900;
    color:#65563f;
  }

  .fault-zone {
    position:absolute;
    left:51%;
    top:2px;
    width:12%;
    height:46px;
    z-index:6;
    border:2px dashed #b9332b;
    background:rgba(190,52,43,.15);
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    color:#ad302a;
    animation:faultPulse 1.3s infinite alternate;
  }

  .fault-zone b {
    font-size:8px;
  }

  .fault-zone small {
    font-size:6px;
    font-weight:900;
  }

  @keyframes faultPulse {
    from { box-shadow:0 0 0 rgba(190,52,43,0); }
    to { box-shadow:0 0 18px rgba(190,52,43,.48); }
  }

  .sim-train {
    position:absolute;
    top:9px;
    z-index:10;
    transform:translateX(-50%);
    width:72px;
    min-height:32px;
    border:2px solid white;
    border-radius:8px;
    color:white;
    display:flex;
    align-items:center;
    justify-content:center;
    gap:4px;
    padding:0 5px;
    box-shadow:0 4px 11px rgba(0,0,0,.28);
    transition:left .42s linear, top .2s ease;
    white-space:nowrap;
  }

  .sim-train span {
    font-size:7px;
    font-weight:900;
  }

  .sim-train.local {
    background:#27805c;
  }

  .sim-train.express {
    background:#c27827;
  }

  .sim-train.superfast {
    background:#b8473c;
  }

  .crossover {
    position:absolute;
    z-index:5;
    width:85px;
    height:2px;
    background:#8c7659;
    transform-origin:left center;
  }

  .crossover-a {
    left:36%;
    top:143px;
    transform:rotate(21deg);
  }

  .crossover-b {
    left:66%;
    top:265px;
    transform:rotate(-21deg);
  }

  .station-building {
    position:absolute;
    z-index:7;
    left:47.5%;
    top:2px;
    width:82px;
    height:32px;
    border:1px solid #ad9877;
    border-radius:0 0 8px 8px;
    background:#f4dfb8;
    text-align:center;
    padding-top:3px;
    color:#17394c;
  }

  .station-building div {
    font-family:Georgia, serif;
    font-size:13px;
    font-weight:900;
  }

  .station-building small {
    font-size:6px;
    font-weight:900;
    letter-spacing:.08em;
  }

  .legend {
    display:flex;
    gap:18px;
    align-items:center;
    flex-wrap:wrap;
    border-top:1px solid #ddd0bd;
    padding:9px 18px;
    font-size:8px;
    font-weight:800;
    background:#fcf8f0;
  }

  .legend span {
    display:flex;
    align-items:center;
    gap:5px;
  }

  .dot {
    width:9px;
    height:9px;
    border-radius:3px;
  }

  .dot.local { background:#27805c; }
  .dot.express { background:#c27827; }
  .dot.superfast { background:#b8473c; }

  .fault-box {
    width:12px;
    height:8px;
    border:1px dashed #b9332b;
    background:rgba(185,51,43,.15);
  }

  .lower-grid {
    max-width:1600px;
    margin:13px auto 0;
    display:grid;
    grid-template-columns:1.6fr .8fr;
    gap:12px;
  }

  .decision-panel,
  .side-panel {
    background:#fffaf3;
    border:1px solid #d9cfbf;
    border-radius:10px;
    overflow:hidden;
  }

  .panel-heading {
    padding:13px 15px;
    display:flex;
    justify-content:space-between;
    align-items:center;
    border-bottom:1px solid #ded4c4;
  }

  .panel-heading h2 {
    font-family:Georgia, serif;
    font-size:18px;
    margin:2px 0 0;
  }

  .panel-heading.compact {
    padding-bottom:11px;
  }

  .recommendation-pill {
    background:#e7f2e9;
    color:#276b49;
    border:1px solid #afd0b8;
    padding:6px 9px;
    border-radius:999px;
    font-size:8px;
    font-weight:900;
  }

  .decision-list {
    padding:10px;
    display:grid;
    gap:8px;
  }

  .decision-card {
    width:100%;
    display:grid;
    grid-template-columns:75px 1fr 70px;
    text-align:left;
    gap:12px;
    align-items:center;
    border:1px solid #ddd3c5;
    background:white;
    border-radius:8px;
    padding:10px;
    cursor:pointer;
    color:#183649;
  }

  .decision-card:hover {
    border-color:#ad8b54;
  }

  .decision-card.recommended {
    border-left:4px solid #33865b;
  }

  .decision-card.selected {
    background:#eef6f0;
    border:2px solid #39815c;
  }

  .decision-rank span {
    display:block;
    font-size:7px;
    font-weight:900;
    color:#97651e;
  }

  .decision-rank strong {
    font-family:Georgia, serif;
    font-size:21px;
  }

  .decision-copy h3 {
    margin:0;
    font-size:12px;
  }

  .decision-copy p {
    margin:3px 0 7px;
    color:#77848c;
    font-size:9px;
  }

  .decision-copy > div {
    display:flex;
    gap:14px;
    font-size:8px;
    color:#667882;
  }

  .select-indicator {
    justify-self:end;
    background:#163f54;
    color:white;
    border-radius:4px;
    padding:6px 7px;
    font-size:7px;
    font-weight:900;
  }

  .event-log {
    padding:10px 14px;
    min-height:188px;
    max-height:220px;
    overflow:auto;
  }

  .event-log > div {
    display:grid;
    grid-template-columns:9px 1fr;
    gap:8px;
    padding:7px 0;
    border-bottom:1px dashed #dfd6c8;
    color:#60747f;
    font-size:8px;
    line-height:1.45;
  }

  .event-log i {
    width:7px;
    height:7px;
    margin-top:2px;
    border-radius:50%;
    background:#b98235;
  }

  .decision-result {
    margin:10px;
    border-radius:8px;
    background:#112f41;
    color:white;
    padding:13px;
  }

  .decision-result span {
    display:block;
    color:#d3a35c;
    font-size:7px;
    font-weight:900;
  }

  .decision-result strong {
    display:block;
    margin:5px 0;
    font-family:Georgia, serif;
    font-size:15px;
  }

  .decision-result p {
    margin:0;
    color:#c3cdd3;
    font-size:8px;
    line-height:1.5;
  }

  @media (max-width: 1050px) {
    .metric-grid {
      grid-template-columns:repeat(2, 1fr);
    }

    .lower-grid {
      grid-template-columns:1fr;
    }

    .track-row {
      grid-template-columns:100px 1fr;
    }

    .track-direction {
      display:none;
    }
  }
`;

