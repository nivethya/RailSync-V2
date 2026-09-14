import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

import L, {
  type LatLngExpression,
} from "leaflet";



type WorkerInfo = {
  worker_id?: number;
  employee_code?: string;
  designation?: string;
  assignment_status?: string;
  progress_percent?: number;
};

type ManagerJob = {
  id: number | string;
  job_code?: string;
  title?: string;
  description?: string;
  severity?: string;
  status?: string;
  maintenance_status?: string;
  inspection_status?: string;
  is_fixed?: boolean;
  fixed_at?: string | null;
  actual_end?: string | null;
  fixed_by_worker?: WorkerInfo | null;
  assigned_worker?: WorkerInfo | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  priority_score?: number | string | null;
  km_marker?: number | string | null;
  estimated_delay_minutes?: number | string | null;
  corridor?: {
    id?: number | string;
    name?: string;
    corridor_code?: string;
  } | null;
  segment?: {
    id?: number | string;
    name?: string;
    segment_code?: string;
    from_station_name?: string;
    to_station_name?: string;
    track_number?: number | string | null;
    direction?: string | null;
  } | null;
};

type Props = {
  jobs: ManagerJob[];
  selectedJob?: ManagerJob | null;
  onSelectJob?: (job: ManagerJob) => void;
};

type Coord = [number, number];

type RouteSpec = {
  name: string;
  points: Coord[];
};


const INDIA_CENTER: LatLngExpression = [
  22.2,
  79.0,
];


const ROUTES: RouteSpec[] = [
  { name: "Delhi – Jaipur – Ahmedabad", points: [[28.6139,77.209],[27.2,76.4],[26.9124,75.7873],[25.0,74.7],[23.0225,72.5714]] },
  { name: "Delhi – Agra – Jhansi – Bhopal", points: [[28.6139,77.209],[27.1767,78.0081],[25.4484,78.5685],[23.2599,77.4126]] },
  { name: "Delhi – Lucknow – Varanasi", points: [[28.6139,77.209],[27.0,79.5],[26.8467,80.9462],[25.3176,82.9739]] },
  { name: "Delhi – Chandigarh – Amritsar", points: [[28.6139,77.209],[30.7333,76.7794],[31.1471,75.3412],[31.634,74.8723]] },
  { name: "Jaipur – Kota – Bhopal", points: [[26.9124,75.7873],[25.2138,75.8648],[24.4,76.4],[23.2599,77.4126]] },
  { name: "Ahmedabad – Vadodara – Surat – Mumbai", points: [[23.0225,72.5714],[22.3072,73.1812],[21.1702,72.8311],[19.076,72.8777]] },
  { name: "Mumbai – Pune – Solapur – Hyderabad", points: [[19.076,72.8777],[18.5204,73.8567],[17.6805,75.9064],[17.385,78.4867]] },
  { name: "Mumbai – Nashik – Bhusawal – Nagpur", points: [[19.076,72.8777],[19.9975,73.7898],[21.05,75.78],[21.1458,79.0882]] },
  { name: "Pune – Kolhapur – Hubballi – Bengaluru", points: [[18.5204,73.8567],[16.705,74.2433],[15.3647,75.124],[12.9716,77.5946]] },
  { name: "Goa – Hubballi – Hyderabad", points: [[15.4909,73.8278],[15.3647,75.124],[16.0,76.8],[17.385,78.4867]] },
  { name: "Hyderabad – Nagpur", points: [[17.385,78.4867],[18.67,78.1],[19.2183,79.1623],[21.1458,79.0882]] },
  { name: "Hyderabad – Vijayawada – Visakhapatnam", points: [[17.385,78.4867],[16.5062,80.648],[17.2,82.2],[17.6868,83.2185]] },
  { name: "Nagpur – Raipur – Bilaspur – Ranchi", points: [[21.1458,79.0882],[21.2514,81.6296],[22.0797,82.1409],[23.3441,85.3096]] },
  { name: "Nagpur – Jabalpur – Prayagraj – Varanasi", points: [[21.1458,79.0882],[23.1815,79.9864],[25.4358,81.8463],[25.3176,82.9739]] },
  { name: "Bhopal – Itarsi – Nagpur", points: [[23.2599,77.4126],[22.6148,77.762],[21.9,78.6],[21.1458,79.0882]] },
  { name: "Bhopal – Ujjain – Indore", points: [[23.2599,77.4126],[23.1765,75.7885],[22.7196,75.8577]] },
  { name: "Indore – Vadodara – Ahmedabad", points: [[22.7196,75.8577],[22.3,74.6],[22.3072,73.1812],[23.0225,72.5714]] },
  { name: "Lucknow – Kanpur – Jhansi", points: [[26.8467,80.9462],[26.4499,80.3319],[25.9,79.5],[25.4484,78.5685]] },
  { name: "Varanasi – Patna – Kolkata", points: [[25.3176,82.9739],[25.5941,85.1376],[23.9,87.1],[22.5726,88.3639]] },
  { name: "Kolkata – Kharagpur – Bhubaneswar", points: [[22.5726,88.3639],[22.346,87.2319],[21.8245,87.26],[20.2961,85.8245]] },
  { name: "Kolkata – Siliguri – Guwahati", points: [[22.5726,88.3639],[24.1,88.25],[26.7271,88.3953],[26.1445,91.7362]] },
  { name: "Chennai – Bengaluru", points: [[13.0827,80.2707],[12.9692,79.1455],[12.57,78.57],[12.9716,77.5946]] },
  { name: "Chennai – Tambaram – Chengalpattu", points: [[13.0827,80.2707],[13.0067,80.2206],[12.9249,80.1],[12.6819,79.9888]] },
  { name: "Chennai – Madurai – Kanyakumari", points: [[13.0827,80.2707],[11.1271,78.6569],[10.7905,78.7047],[9.9252,78.1198],[8.0883,77.5385]] },
  { name: "Bengaluru – Mysuru – Mangaluru", points: [[12.9716,77.5946],[12.5211,76.895],[12.3,75.8],[12.9141,74.856]] },
  { name: "Bengaluru – Kochi – Thiruvananthapuram", points: [[12.9716,77.5946],[11.0168,76.9558],[9.9312,76.2673],[8.5241,76.9366]] },
  { name: "Bengaluru – Hyderabad", points: [[12.9716,77.5946],[14.6819,77.6006],[15.8281,78.0373],[17.385,78.4867]] },
  { name: "Vijayawada – Chennai", points: [[16.5062,80.648],[15.5,80.05],[14.4426,79.9865],[13.0827,80.2707]] },
  { name: "Bhubaneswar – Visakhapatnam – Vijayawada", points: [[20.2961,85.8245],[19.0,84.3],[17.6868,83.2185],[16.5062,80.648]] },
  { name: "Raipur – Sambalpur – Bhubaneswar", points: [[21.2514,81.6296],[21.4669,83.9812],[20.9,84.9],[20.2961,85.8245]] },
];



function severityRank(
  value?: string,
) {
  switch (
    String(
      value ?? "",
    ).toUpperCase()
  ) {
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


function severityStyle(
  value?: string,
) {
  switch (
    String(
      value ?? "",
    ).toUpperCase()
  ) {
    case "CRITICAL":
      return {
        color: "#7d1f1b",
        fillColor: "#d84a3a",
      };

    case "HIGH":
      return {
        color: "#8a4713",
        fillColor: "#ef8b2c",
      };

    case "MEDIUM":
      return {
        color: "#80610d",
        fillColor: "#e5b840",
      };

    case "LOW":
      return {
        color: "#285c49",
        fillColor: "#67a888",
      };

    default:
      return {
        color: "#29495d",
        fillColor: "#6f93a8",
      };
  }
}


function formatTime(
  value?: string | null,
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }

  return date.toLocaleString(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  );
}



function SelectedJobFocus({
  selectedJob,
}: {
  selectedJob?: ManagerJob | null;
}) {
  const map =
    useMap();

  useEffect(
    () => {
      if (!selectedJob) {
        return;
      }

      map.flyTo(
        jobDisplayPosition(
          selectedJob,
        ),
        Math.max(
          map.getZoom(),
          9,
        ),
        {
          duration: 0.6,
        },
      );
    },
    [
      map,
      selectedJob,
    ],
  );

  return null;
}


function ZoomWatcher({
  onZoom,
}: {
  onZoom: (
    zoom: number,
  ) => void;
}) {
  const map =
    useMapEvents({
      zoomend() {
        onZoom(
          map.getZoom(),
        );
      },
    });

  useEffect(
    () => {
      onZoom(
        map.getZoom(),
      );
    },
    [
      map,
      onZoom,
    ],
  );

  return null;
}


function interpolate(
  points: Coord[],
  progress: number,
): Coord {
  const p =
    Math.max(
      0,
      Math.min(
        .9999,
        progress,
      ),
    );

  const scaled =
    p * (
      points.length - 1
    );

  const index =
    Math.floor(
      scaled,
    );

  const local =
    scaled - index;

  const a =
    points[index];

  const b =
    points[
      Math.min(
        points.length - 1,
        index + 1,
      )
    ];

  return [
    a[0]
    + (
      b[0] - a[0]
    ) * local,

    a[1]
    + (
      b[1] - a[1]
    ) * local,
  ];
}



function pseudoRandom(
  seed: number,
) {
  const value =
    Math.sin(
      seed * 12.9898
      + 78.233,
    )
    * 43758.5453;

  return (
    value
    - Math.floor(value)
  );
}


function normalizedText(
  value?: string | null,
) {
  return String(
    value ?? "",
  )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " ",
    )
    .trim();
}


function routeMatchScore(
  job: ManagerJob,
  route: RouteSpec,
) {
  const corridor =
    normalizedText(
      job.corridor?.name,
    );

  const segment =
    normalizedText(
      job.segment?.name,
    );

  const fromStation =
    normalizedText(
      job.segment
        ?.from_station_name,
    );

  const toStation =
    normalizedText(
      job.segment
        ?.to_station_name,
    );

  const routeName =
    normalizedText(
      route.name,
    );

  const tokens =
    [
      ...corridor.split(" "),
      ...segment.split(" "),
      ...fromStation.split(" "),
      ...toStation.split(" "),
    ].filter(
      (token) =>
        token.length >= 4,
    );

  let score = 0;

  for (
    const token
    of tokens
  ) {
    if (
      routeName.includes(
        token,
      )
    ) {
      score += 1;
    }
  }

  return score;
}


function resolveJobRouteIndex(
  job: ManagerJob,
) {
  let bestIndex = -1;
  let bestScore = 0;

  for (
    let index = 0;
    index < ROUTES.length;
    index += 1
  ) {
    const score =
      routeMatchScore(
        job,
        ROUTES[index],
      );

    if (
      score > bestScore
    ) {
      bestScore = score;
      bestIndex = index;
    }
  }

  if (
    bestIndex >= 0
    &&
    bestScore > 0
  ) {
    return bestIndex;
  }

  const id =
    Number(job.id)
    || 1;

  return (
    Math.abs(
      id * 31,
    )
    % ROUTES.length
  );
}


function jobDisplayPosition(
  job: ManagerJob,
): Coord {
  /*
   * DEMO_REPLAY location policy:
   * 1) Match the job's real corridor / segment / station names to the
   *    corresponding visual railway corridor whenever possible.
   * 2) Keep the same job at the same point after every refresh.
   * 3) Add only a tiny offset so overlapping jobs remain clickable.
   *
   * Example: a Tambaram / Chennai job is rendered on the
   * Chennai–Tambaram–Chengalpattu corridor, not somewhere else in India.
   */
  const id =
    Number(job.id)
    || 1;

  const routeIndex =
    resolveJobRouteIndex(
      job,
    );

  const route =
    ROUTES[routeIndex];

  const km =
    Number(
      job.km_marker,
    );

  const baseProgress =
    Number.isFinite(km)
      ? (
          (
            Math.abs(km)
            % 100
          )
          / 100
        )
      : pseudoRandom(
          id * 47,
        );

  const progress =
    0.04
    + baseProgress
    * 0.92;

  const base =
    interpolate(
      route.points,
      progress,
    );

  const angle =
    pseudoRandom(
      id * 61,
    )
    * Math.PI
    * 2;

  const distance =
    0.006
    + pseudoRandom(
      id * 73,
    )
    * 0.018;

  return [
    base[0]
    + Math.sin(angle)
    * distance,

    base[1]
    + Math.cos(angle)
    * distance,
  ];
}



function trainIcon(
  index: number,
) {
  const palette = [
    "#2c7a55",
    "#d18a2d",
    "#b9473f",
  ];

  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:23px;
        height:23px;
        border-radius:6px;
        background:${palette[index % palette.length]};
        border:2px solid white;
        display:grid;
        place-items:center;
        box-shadow:0 3px 8px rgba(0,0,0,.25);
        font-size:11px;
      ">🚆</div>
    `,
    iconSize: [
      23,
      23,
    ],
    iconAnchor: [
      11,
      11,
    ],
  });
}


export default function ManagerSmartMap({
  jobs,
  selectedJob,
  onSelectJob,
}: Props) {
  const [
    zoom,
    setZoom,
  ] = useState(5);

  const [
    tick,
    setTick,
  ] = useState(0);



  useEffect(
    () => {
      const timer =
        window.setInterval(
          () => {
            setTick(
              (value) =>
                value + 1,
            );
          },
          850,
        );

      return () =>
        window.clearInterval(
          timer,
        );
    },
    [],
  );



  const allJobs =
    useMemo(
      () => {
        return [...jobs]
          .sort(
            (
              a,
              b,
            ) => {
              const aFixed =
                Boolean(
                  a.is_fixed
                  ||
                  String(
                    a.status ?? "",
                  ).toUpperCase()
                  === "FIXED",
                );

              const bFixed =
                Boolean(
                  b.is_fixed
                  ||
                  String(
                    b.status ?? "",
                  ).toUpperCase()
                  === "FIXED",
                );

              if (
                aFixed !== bFixed
              ) {
                return aFixed
                  ? 1
                  : -1;
              }

              const severity =
                severityRank(
                  b.severity,
                )
                -
                severityRank(
                  a.severity,
                );

              if (
                severity !== 0
              ) {
                return severity;
              }

              return (
                Number(
                  b.priority_score
                  ?? 0,
                )
                -
                Number(
                  a.priority_score
                  ?? 0,
                )
              );
            },
          );
      },
      [
        jobs,
      ],
    );


  const faultPoints =
    useMemo(
      () =>
        allJobs.map(
          (
            job,
          ) => {
            const [
              lat,
              lon,
            ] =
              jobDisplayPosition(
                job,
              );

            return {
              job,
              lat,
              lon,
            };
          },
        ),
      [
        allJobs,
      ],
    );


  const fixedCount =
    allJobs.filter(
      (job) =>
        Boolean(
          job.is_fixed
          ||
          String(
            job.status ?? "",
          ).toUpperCase()
          === "FIXED",
        ),
    ).length;

  const activeCount =
    allJobs.length
    - fixedCount;

  const selectedId =
    selectedJob?.id;


  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        minHeight: 500,
        width: "100%",
        overflow: "hidden",
      }}
    >
      <MapContainer
        center={
          INDIA_CENTER
        }
        zoom={5}
        minZoom={4}
        maxZoom={15}
        scrollWheelZoom
        style={{
          height: "100%",
          width: "100%",
          minHeight: 500,
          background: "#e8e4da",
        }}
      >
        <TileLayer
          attribution="© OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <TileLayer
          attribution="OpenRailwayMap"
          url="https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png"
          opacity={0.72}
        />

        <ZoomWatcher
          onZoom={
            setZoom
          }
        />

        <SelectedJobFocus
          selectedJob={
            selectedJob
          }
        />

        {ROUTES.map(
          (
            route,
          ) => (
            <Polyline
              key={
                route.name
              }
              positions={
                route.points
              }
              pathOptions={{
                color:
                  "#3f6575",
                weight: 1.5,
                opacity: .24,
              }}
            />
          ),
        )}

        {Array.from({
          length: 60,
        }).map(
          (
            _,
            index,
          ) => {
            const route =
              ROUTES[
                index
                % ROUTES.length
              ];

            const phase =
              (
                (
                  index
                  * .071
                )
                +
                tick
                * (
                  .0017
                  +
                  (
                    index % 6
                  )
                  * .00015
                )
              )
              % 1;

            const progress =
              index % 2 === 0
                ? phase
                : 1 - phase;

            return (
              <Marker
                key={
                  `mgr-train-${index}`
                }
                position={
                  interpolate(
                    route.points,
                    progress,
                  )
                }
                icon={
                  trainIcon(
                    index,
                  )
                }
                zIndexOffset={
                  150
                }
              >
                <Popup>
                  <b>
                    DEMO_REPLAY TRAIN
                  </b>

                  <br />

                  {
                    route.name
                  }
                </Popup>
              </Marker>
            );
          },
        )}

        {faultPoints.map(
          (
            point,
            index,
          ) => {
            const job =
              point.job;

            const fixed =
              Boolean(
                job.is_fixed
                ||
                String(
                  job.status
                  ?? "",
                ).toUpperCase()
                === "FIXED"
                ||
                String(
                  job.status
                  ?? "",
                ).toUpperCase()
                === "COMPLETED",
              );

            const style =
              fixed
                ? {
                    color:
                      "#1f6b48",
                    fillColor:
                      "#4fb477",
                  }
                : severityStyle(
                    job.severity,
                  );

            const isSelected =
              selectedId != null
              &&
              job.id
              === selectedId;

            const radius =
              isSelected
                ? 8.5
                : fixed
                ? 3.2
                : severityRank(
                    job.severity,
                  ) >= 4
                ? 5.0
                : severityRank(
                    job.severity,
                  ) === 3
                ? 4.4
                : severityRank(
                    job.severity,
                  ) === 2
                ? 3.8
                : 3.3;

            return (
              <CircleMarker
                key={
                  `fault-${job.id}-${index}`
                }
                center={[
                  point.lat,
                  point.lon,
                ]}
                radius={
                  radius
                }
                pathOptions={{
                  color:
                    isSelected
                      ? "#0c3d5a"
                      : style.color,

                  fillColor:
                    style.fillColor,

                  fillOpacity:
                    fixed
                      ? .72
                      : .82,

                  opacity:
                    .92,

                  weight:
                    isSelected
                      ? 3
                      : 1,
                }}
                eventHandlers={{
                  click: (
                    event,
                  ) => {
                    event.target.openPopup();

                    if (
                      onSelectJob
                    ) {
                      onSelectJob(
                        job,
                      );
                    }
                  },
                }}
              >
                <Popup>
                  {
                    fixed
                      ? (
                        <div
                          style={{
                            minWidth:
                              245,
                          }}
                        >
                          <strong
                            style={{
                              color:
                                "#24704c",
                            }}
                          >
                            ✓ FIXED · {
                              job.job_code
                              ?? "Maintenance Job"
                            }
                          </strong>

                          <div
                            style={{
                              marginTop:
                                5,
                            }}
                          >
                            {
                              job.title
                              ?? "Railway maintenance event"
                            }
                          </div>

                          <div
                            style={{
                              marginTop:
                                8,
                              fontSize:
                                12,
                              lineHeight:
                                1.55,
                            }}
                          >
                            Original severity:{" "}
                            <b>
                              {
                                job.severity
                                ?? "—"
                              }
                            </b>
                            <br />

                            Inspection:{" "}
                            <b>
                              {
                                job.inspection_status
                                ?? "COMPLETED"
                              }
                            </b>
                            <br />

                            Fixed by:{" "}
                            <b>
                              {
                                job.fixed_by_worker
                                  ?.employee_code
                                ??
                                job.assigned_worker
                                  ?.employee_code
                                ??
                                "Maintenance worker"
                              }
                            </b>
                            <br />

                            Fixed at:{" "}
                            <b>
                              {
                                formatTime(
                                  job.actual_end
                                  ?? null,
                                )
                              }
                            </b>
                          </div>
                        </div>
                      )
                      : (
                        <div
                          style={{
                            minWidth:
                              245,
                          }}
                        >
                          <strong>
                            ⚠ {
                              job.job_code
                              ?? "Maintenance Job"
                            }
                          </strong>

                          <div
                            style={{
                              marginTop:
                                5,
                            }}
                          >
                            {
                              job.title
                              ?? "Railway maintenance event"
                            }
                          </div>

                          <div
                            style={{
                              marginTop:
                                8,
                              fontSize:
                                12,
                              lineHeight:
                                1.55,
                            }}
                          >
                            Severity:{" "}
                            <b>
                              {
                                job.severity
                                ?? "—"
                              }
                            </b>
                            <br />

                            Status:{" "}
                            <b>
                              {
                                job.status
                                ?? "—"
                              }
                            </b>
                            <br />

                            AI priority:{" "}
                            <b>
                              {
                                job.priority_score
                                ?? "—"
                              }
                            </b>
                            <br />

                            Assigned worker:{" "}
                            <b>
                              {
                                job.assigned_worker
                                  ?.employee_code
                                ??
                                "UNASSIGNED"
                              }
                            </b>
                            <br />

                            Corridor:{" "}
                            <b>
                              {
                                job.corridor
                                  ?.name
                                ?? "—"
                              }
                            </b>
                            <br />

                            Section:{" "}
                            <b>
                              {
                                job.segment
                                  ?.name
                                ?? "—"
                              }
                            </b>
                            <br />

                            KM marker:{" "}
                            <b>
                              {
                                job.km_marker
                                ?? "—"
                              }
                            </b>
                            <br />

                            Display location:{" "}
                            <b>
                              MATCHED TO JOB CORRIDOR
                            </b>
                          </div>

                          {
                            onSelectJob
                            && (
                              <button
                                type="button"
                                onClick={() =>
                                  onSelectJob(
                                    job,
                                  )
                                }
                                style={{
                                  marginTop:
                                    9,
                                  border:
                                    0,
                                  borderRadius:
                                    5,
                                  padding:
                                    "7px 10px",
                                  background:
                                    "#123e57",
                                  color:
                                    "#fff",
                                  cursor:
                                    "pointer",
                                  fontSize:
                                    11,
                                  fontWeight:
                                    700,
                                }}
                              >
                                Open Job Control
                              </button>
                            )
                          }
                        </div>
                      )
                  }
                </Popup>
              </CircleMarker>
            );
          },
        )}
      </MapContainer>

      <div
        style={{
          position:
            "absolute",
          zIndex: 900,
          top: 12,
          left: 12,
          right: 12,
          display: "flex",
          gap: 7,
          flexWrap: "wrap",
          pointerEvents: "none",
        }}
      >
        <span
          style={
            darkBadge
          }
        >
          MANAGER PAN-INDIA CONTROL · FAULTS MATCHED TO THEIR JOB CORRIDORS
        </span>

        <span
          style={
            redBadge
          }
        >
          ⚠ {activeCount} ACTIVE
        </span>

        <span
          style={
            greenBadge
          }
        >
          ✓ {fixedCount} FIXED
        </span>

      </div>

      <div
        style={{
          position:
            "absolute",
          zIndex: 900,
          left: 12,
          bottom: 12,
          display: "flex",
          gap: 7,
          flexWrap: "wrap",
          pointerEvents: "none",
        }}
      >
        <span
          style={
            lightBadge
          }
        >
          {allJobs.length} TOTAL FAULT / MAINTENANCE RECORDS REPRESENTED
        </span>

        <span
          style={
            lightBadge
          }
        >
          ZOOM {zoom} · ALL FAULTS REMAIN INDIVIDUAL
        </span>

        <span
          style={
            lightBadge
          }
        >
          DEMO_REPLAY · TAMBARAM JOBS STAY ON TAMBARAM / CHENNAI CORRIDOR
        </span>
      </div>
    </div>
  );
}


const darkBadge:
  React.CSSProperties = {
    background:
      "rgba(12,42,58,.94)",
    color: "#fff",
    border:
      "1px solid rgba(255,255,255,.15)",
    borderRadius: 6,
    padding:
      "6px 9px",
    fontSize: 9,
    fontWeight: 900,
  };


const lightBadge:
  React.CSSProperties = {
    background:
      "rgba(255,255,255,.95)",
    color: "#29495d",
    border:
      "1px solid #d6c9b6",
    borderRadius: 6,
    padding:
      "6px 9px",
    fontSize: 9,
    fontWeight: 900,
  };


const greenBadge:
  React.CSSProperties = {
    ...lightBadge,
    color:
      "#246b49",
    border:
      "1px solid #b9d9c4",
  };



const redBadge:
  React.CSSProperties = {
    ...lightBadge,
    color:
      "#a83a33",
    border:
      "1px solid #e0b6b3",
  };
