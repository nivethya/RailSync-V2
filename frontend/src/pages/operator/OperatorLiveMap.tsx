import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import api from "../../services/api";

type AffectedTrain = {
  id: number;
  disruption_id?: number;
  train_number?: string;
  train_name?: string;
  predicted_delay_minutes?: number | string | null;
  priority_class?: string | null;
};

type Disruption = {
  id: number;
  disruption_code?: string;
  severity?: string;
  reason?: string;
  status?: string;
  estimated_delay_minutes?: number | string | null;
  job?: {
    job_code?: string;
    title?: string;
    km_marker?: number | string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
  } | null;
};

type Props = {
  trains: AffectedTrain[];
  selectedDisruptionId: number | null;
};

type Coord = [number, number];

type RouteSpec = {
  name: string;
  points: Coord[];
};

const ROUTES: RouteSpec[] = [
  {
    name: "Chennai – Tambaram – Chengalpattu",
    points: [[13.0827,80.2707],[13.0067,80.2206],[12.9249,80.1000],[12.8231,80.0442],[12.6819,79.9888]],
  },
  {
    name: "Chennai – Arakkonam – Katpadi",
    points: [[13.0827,80.2707],[13.1180,80.0400],[13.0840,79.6700],[12.9692,79.1455]],
  },
  {
    name: "Chennai – Bengaluru",
    points: [[13.0827,80.2707],[12.9692,79.1455],[12.5700,78.5700],[12.9716,77.5946]],
  },
  {
    name: "Chennai – Madurai – Kanyakumari",
    points: [[13.0827,80.2707],[11.1271,78.6569],[10.7905,78.7047],[9.9252,78.1198],[8.0883,77.5385]],
  },
  {
    name: "Bengaluru – Mysuru",
    points: [[12.9716,77.5946],[12.75,77],[12.5211,76.895]],
  },
  {
    name: "Bengaluru – Kochi – Thiruvananthapuram",
    points: [[12.9716,77.5946],[11.0168,76.9558],[9.9312,76.2673],[8.5241,76.9366]],
  },
  {
    name: "Chennai – Vijayawada – Visakhapatnam",
    points: [[13.0827,80.2707],[14.4426,79.9865],[16.5062,80.648],[17.6868,83.2185]],
  },
  {
    name: "Hyderabad – Vijayawada",
    points: [[17.385,78.4867],[16.95,79.4],[16.5062,80.648]],
  },
  {
    name: "Hyderabad – Nagpur",
    points: [[17.385,78.4867],[19.2183,79.1623],[21.1458,79.0882]],
  },
  {
    name: "Mumbai – Pune",
    points: [[19.076,72.8777],[18.95,73.15],[18.8,73.35],[18.5204,73.8567]],
  },
  {
    name: "Mumbai – Surat – Ahmedabad",
    points: [[19.076,72.8777],[20.1,72.93],[21.1702,72.8311],[23.0225,72.5714]],
  },
  {
    name: "Ahmedabad – Jaipur – Delhi",
    points: [[23.0225,72.5714],[24.5854,73.7125],[26.9124,75.7873],[28.6139,77.209]],
  },
  {
    name: "Delhi – Agra – Jhansi",
    points: [[28.6139,77.209],[27.1767,78.0081],[26.22,78.18],[25.4484,78.5685]],
  },
  {
    name: "Delhi – Chandigarh – Amritsar",
    points: [[28.6139,77.209],[30.7333,76.7794],[31.1471,75.3412],[31.634,74.8723]],
  },
  {
    name: "Delhi – Lucknow – Varanasi",
    points: [[28.6139,77.209],[26.8467,80.9462],[25.3176,82.9739]],
  },
  {
    name: "Varanasi – Patna – Kolkata",
    points: [[25.3176,82.9739],[25.5941,85.1376],[24.79,87.9],[22.5726,88.3639]],
  },
  {
    name: "Howrah – Kharagpur – Bhubaneswar",
    points: [[22.5726,88.3639],[22.346,87.2319],[21.8245,87.26],[20.2961,85.8245]],
  },
  {
    name: "Kolkata – Siliguri – Guwahati",
    points: [[22.5726,88.3639],[24.1,88.25],[26.7271,88.3953],[26.1445,91.7362]],
  },
  {
    name: "Nagpur – Bhopal – Delhi",
    points: [[21.1458,79.0882],[23.2599,77.4126],[25.4358,78.56],[28.6139,77.209]],
  },
  {
    name: "Nagpur – Raipur – Bilaspur",
    points: [[21.1458,79.0882],[21.2514,81.6296],[22.0797,82.1409]],
  },
  {
    name: "Bhopal – Kota – Jaipur",
    points: [[23.2599,77.4126],[25.2138,75.8648],[26.9124,75.7873]],
  },
  {
    name: "Pune – Solapur – Hyderabad",
    points: [[18.5204,73.8567],[17.6805,75.9064],[17.385,78.4867]],
  },
  {
    name: "Bengaluru – Hubballi – Goa",
    points: [[12.9716,77.5946],[14.4426,75.5],[15.3647,75.124],[15.4909,73.8278]],
  },
];

const LANE_VALUES = [-2,-1,0,1,2];

function num(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readDisruptions(data: unknown): Disruption[] {
  if (Array.isArray(data)) return data as Disruption[];
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  return Array.isArray(obj.disruptions) ? obj.disruptions as Disruption[] : [];
}

function interpolateRoute(points: Coord[], progress: number): Coord {
  if (points.length === 1) return points[0];

  const p = Math.max(0, Math.min(0.99999, progress));
  const scaled = p * (points.length - 1);
  const index = Math.floor(scaled);
  const local = scaled - index;
  const a = points[index];
  const b = points[Math.min(index + 1, points.length - 1)];

  return [
    a[0] + (b[0] - a[0]) * local,
    a[1] + (b[1] - a[1]) * local,
  ];
}

function offsetRoute(points: Coord[], laneIndex: number): Coord[] {
  const spacing = 0.02;
  const offset = laneIndex * spacing;

  return points.map(([lat, lon], index) => {
    const prev = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const dy = next[0] - prev[0];
    const dx = next[1] - prev[1];
    const length = Math.sqrt(dx * dx + dy * dy) || 1;

    return [
      lat + (dx / length) * offset,
      lon - (dy / length) * offset,
    ] as Coord;
  });
}

const TRACK_LANES = ROUTES.flatMap((route, routeIndex) =>
  LANE_VALUES.map((laneIndex) => ({
    key: `${routeIndex}-${laneIndex}`,
    routeIndex,
    laneIndex,
    points: offsetRoute(route.points, laneIndex),
  })),
);

const DEMO_TRAINS: AffectedTrain[] = Array.from(
  { length: 115 },
  (_, i) => ({
    id: 10000 + i,
    train_number: `IR-${String(1001 + i).padStart(4, "0")}`,
    train_name:
      i % 5 === 0
        ? "Intercity Express · DEMO_REPLAY"
        : i % 3 === 0
        ? "Superfast Service · DEMO_REPLAY"
        : "Passenger / Local Service · DEMO_REPLAY",
    predicted_delay_minutes: 2 + ((i * 7) % 31),
    priority_class:
      i % 5 === 0
        ? "EXPRESS"
        : i % 3 === 0
        ? "SUPERFAST"
        : "LOCAL",
  }),
);

function trainTone(delay: number) {
  if (delay >= 30) return "#cf3d35";
  if (delay >= 15) return "#d58a2d";
  return "#287a54";
}

function faultTone(severity?: string) {
  switch (String(severity ?? "").toUpperCase()) {
    case "CRITICAL": return "#c7302b";
    case "HIGH": return "#e06424";
    case "MEDIUM": return "#d09a20";
    default: return "#447861";
  }
}

function trainIcon(delay: number) {
  const tone = trainTone(delay);

  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:26px;height:26px;border-radius:7px;
        background:${tone};border:2px solid #fff;
        box-shadow:0 3px 9px rgba(0,0,0,.32);
        display:grid;place-items:center;font-size:13px;
      ">🚆</div>
    `,
    iconSize: [26,26],
    iconAnchor: [13,13],
    popupAnchor: [0,-13],
  });
}

function faultIcon(severity?: string, selected = false) {
  const tone = faultTone(severity);
  const size = selected ? 42 : 28;

  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:${size}px;height:${size}px">
        <div style="
          position:absolute;inset:${selected ? -11 : -5}px;
          border-radius:999px;background:${tone};opacity:.22;
          animation:railsyncPulse 1.7s ease-out infinite;
        "></div>
        <div style="
          position:absolute;inset:0;border-radius:999px;
          background:${tone};border:${selected ? 4 : 2}px solid #fff;
          box-shadow:0 4px 14px rgba(0,0,0,.36);
          display:grid;place-items:center;color:white;
          font-size:${selected ? 18 : 12}px;font-weight:900;
        ">⚠</div>
      </div>
    `,
    iconSize: [size,size],
    iconAnchor: [size / 2,size / 2],
    popupAnchor: [0,-size / 2],
  });
}

/*
 * Seeded disruption rows often do not have true coordinates.
 * Instead of collapsing those 50+ records onto one fallback marker,
 * each disruption is deterministically mapped to a separate corridor,
 * track lane, and progress point for DEMO_REPLAY visualization.
 */
function disruptionPosition(disruption: Disruption, index: number): Coord {
  const lat = Number(disruption.job?.latitude);
  const lon = Number(disruption.job?.longitude);

  if (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= 6 && lat <= 38 &&
    lon >= 67 && lon <= 98
  ) {
    return [lat, lon];
  }

  const seed = Math.abs((disruption.id || index + 1) * 2654435761);
  const routeIndex = (disruption.id + index * 3) % ROUTES.length;
  const laneIndex = LANE_VALUES[(disruption.id + index) % LANE_VALUES.length];

  const laneRoute = offsetRoute(
    ROUTES[routeIndex].points,
    laneIndex,
  );

  const progress =
    0.06 +
    (((seed % 10000) / 10000) * 0.88);

  return interpolateRoute(
    laneRoute,
    progress,
  );
}

function MapFocusController({
  disruptions,
  selectedDisruptionId,
}: {
  disruptions: Disruption[];
  selectedDisruptionId: number | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedDisruptionId == null) return;

    const index = disruptions.findIndex(
      (item) => item.id === selectedDisruptionId,
    );

    if (index < 0) return;

    const position = disruptionPosition(disruptions[index], index);

    map.flyTo(
      position,
      8,
      { duration: 0.8 },
    );
  }, [disruptions, selectedDisruptionId, map]);

  return null;
}

export default function OperatorLiveMap({
  trains,
  selectedDisruptionId,
}: Props) {
  const [tick, setTick] = useState(0);
  const [disruptions, setDisruptions] = useState<Disruption[]>([]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setTick((value) => value + 1),
      750,
    );

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await api.get("/operator/disruptions");
        if (active) {
          setDisruptions(readDisruptions(response.data));
        }
      } catch {
        if (active) setDisruptions([]);
      }
    }

    void load();

    const timer = window.setInterval(
      () => void load(),
      12000,
    );

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const visibleTrains = useMemo(() => {
    const selected = trains.filter(
      (train) =>
        selectedDisruptionId == null ||
        train.disruption_id === selectedDisruptionId,
    );

    return selected.length > 0 ? selected : DEMO_TRAINS;
  }, [trains, selectedDisruptionId]);

  const visibleFaults = useMemo(
    () => disruptions,
    [disruptions],
  );

  return (
    <div
      style={{
        height: 500,
        width: "100%",
        position: "relative",
      }}
    >
      <style>
        {`
          @keyframes railsyncPulse {
            0% { transform: scale(.7); opacity:.38; }
            70% { transform: scale(1.45); opacity:0; }
            100% { transform: scale(1.45); opacity:0; }
          }
        `}
      </style>

      <div
        style={{
          position: "absolute",
          zIndex: 1000,
          top: 10,
          left: 10,
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          pointerEvents: "none",
        }}
      >
        <span style={badgeDark}>
          DEMO REPLAY · 115 TRAINS · PAN-INDIA MULTI-TRACK
        </span>

        <span style={badgeLight}>
          ⚠ {visibleFaults.length} ACTIVE FAULTS ON MAP
        </span>

        <span style={badgeLight}>
          🚆 trains use separate UP / DOWN / MAIN lanes
        </span>
      </div>

      <MapContainer
        center={[20.4,78.7]}
        zoom={5}
        minZoom={4}
        maxZoom={14}
        scrollWheelZoom
        style={{
          height: "100%",
          width: "100%",
          background: "#e9e4d9",
        }}
      >
        <MapFocusController
          disruptions={disruptions}
          selectedDisruptionId={selectedDisruptionId}
        />

        <TileLayer
          attribution="© OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <TileLayer
          attribution="OpenRailwayMap"
          url="https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png"
          opacity={0.72}
        />

        {TRACK_LANES.map((track) => (
          <Polyline
            key={track.key}
            positions={track.points}
            pathOptions={{
              color:
                track.laneIndex === 0
                  ? "#263f4d"
                  : "#71838c",
              weight:
                track.laneIndex === 0
                  ? 3.5
                  : 2,
              opacity:
                track.laneIndex === 0
                  ? 0.72
                  : 0.45,
            }}
          />
        ))}

        {visibleFaults.map((disruption, index) => {
          const position = disruptionPosition(disruption, index);
          const selected = disruption.id === selectedDisruptionId;

          return (
            <Marker
              key={`fault-${disruption.id}`}
              position={position}
              icon={faultIcon(disruption.severity, selected)}
              zIndexOffset={selected ? 1000 : 400}
            >
              <Popup>
                <div style={{ minWidth: 220 }}>
                  <strong>
                    ⚠ {disruption.disruption_code ?? `DIS-${disruption.id}`}
                    {selected ? " · SELECTED" : ""}
                  </strong>

                  <div style={{ marginTop: 6, fontWeight: 700 }}>
                    {disruption.job?.title ?? disruption.reason ?? "Railway fault / maintenance disruption"}
                  </div>

                  <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.55 }}>
                    Severity: <b>{disruption.severity ?? "—"}</b><br />
                    Status: <b>{disruption.status ?? "—"}</b><br />
                    Predicted delay: <b>+{Math.round(num(disruption.estimated_delay_minutes))} min</b><br />
                    Job: <b>{disruption.job?.job_code ?? "—"}</b><br />
                    Location mode: <b>{disruption.job?.latitude ? "JOB COORDINATE" : "DEMO_REPLAY DISTRIBUTION"}</b>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {visibleTrains.map((train, index) => {
          const routeIndex =
            train.id >= 10000
              ? (train.id - 10000) % ROUTES.length
              : (train.id + index) % ROUTES.length;

          const laneIndex =
            LANE_VALUES[
              Math.abs(train.id + index)
              % LANE_VALUES.length
            ];

          const route = offsetRoute(
            ROUTES[routeIndex].points,
            laneIndex,
          );

          const delay = num(train.predicted_delay_minutes);

          // Different base offsets keep trains separated instead of stacked.
          const phaseBase =
            ((train.id * 37 + index * 11) % 1000) / 1000;

          const speed =
            0.0016 +
            ((train.id + index) % 7) * 0.00024;

          const rawProgress =
            (phaseBase + tick * speed) % 1;

          const progress =
            laneIndex < 0
              ? 1 - rawProgress
              : rawProgress;

          const position = interpolateRoute(
            route,
            progress,
          );

          return (
            <Marker
              key={`train-${train.id}`}
              position={position}
              icon={trainIcon(delay)}
              zIndexOffset={200}
            >
              <Popup>
                <div style={{ minWidth: 220 }}>
                  <strong>
                    🚆 {train.train_number ?? `TRAIN-${train.id}`}
                  </strong>

                  <div style={{ marginTop: 5 }}>
                    {train.train_name ?? "Scheduled service"}
                  </div>

                  <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.55 }}>
                    Corridor: <b>{ROUTES[routeIndex].name}</b><br />
                    Track: <b>{
                      laneIndex < 0
                        ? `UP ${Math.abs(laneIndex)}`
                        : laneIndex > 0
                        ? `DOWN ${laneIndex}`
                        : "MAIN"
                    }</b><br />
                    Predicted delay: <b>+{Math.round(delay)} min</b><br />
                    Priority: <b>{train.priority_class ?? "NORMAL"}</b><br />
                    Source: <b>DEMO_REPLAY</b>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

const badgeDark: React.CSSProperties = {
  padding: "5px 8px",
  borderRadius: 5,
  background: "rgba(12,37,53,.93)",
  color: "#fff",
  fontSize: 9,
  fontWeight: 900,
};

const badgeLight: React.CSSProperties = {
  padding: "5px 8px",
  borderRadius: 5,
  background: "rgba(255,255,255,.96)",
  color: "#315367",
  fontSize: 9,
  fontWeight: 900,
};
