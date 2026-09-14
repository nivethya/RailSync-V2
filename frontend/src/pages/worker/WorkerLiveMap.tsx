import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  ArrowLeft,
  Clock3,
  MapPinned,
  Navigation,
  RefreshCw,
  TrainFront,
  Wrench,
} from "lucide-react";

import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

import type {
  LatLngExpression,
} from "leaflet";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import api from "../../services/api";


type Job = {
  id?: number;
  job_code?: string;
  title?: string;
  description?: string;
  severity?: string;
  status?: string;
  estimated_minutes?: number;
  km_marker?: number;
  latitude?: number | string | null;
  longitude?: number | string | null;

  corridor?: {
    name?: string;
  } | null;

  segment?: {
    name?: string;
  } | null;
};

type Assignment = {
  id: number;
  status?: string;
  progress_percent?: number;
  assigned_at?: string | null;
  started_at?: string | null;

  job?: Job | null;
  maintenance_job?: Job | null;
};


function norm(value?: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}


function getAssignments(
  data: unknown,
): Assignment[] {
  if (Array.isArray(data)) {
    return data as Assignment[];
  }

  if (!data || typeof data !== "object") {
    return [];
  }

  const obj =
    data as Record<string, unknown>;

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


function getJob(
  assignment: Assignment,
) {
  return (
    assignment.job
    ??
    assignment.maintenance_job
    ??
    null
  );
}


function severityColor(
  severity?: string,
) {
  switch (norm(severity)) {
    case "CRITICAL":
      return {
        stroke: "#8b201b",
        fill: "#d94a3a",
      };

    case "HIGH":
      return {
        stroke: "#945315",
        fill: "#ee8d2f",
      };

    case "MEDIUM":
      return {
        stroke: "#81630f",
        fill: "#e4b942",
      };

    default:
      return {
        stroke: "#2f6f50",
        fill: "#67a887",
      };
  }
}


function FocusSelected({
  assignment,
}: {
  assignment:
    Assignment
    | null;
}) {
  const map =
    useMap();

  useEffect(() => {
    if (!assignment) {
      return;
    }

    const job =
      getJob(
        assignment,
      );

    const lat =
      Number(
        job?.latitude,
      );

    const lon =
      Number(
        job?.longitude,
      );

    if (
      !Number.isFinite(lat)
      ||
      !Number.isFinite(lon)
    ) {
      return;
    }

    map.flyTo(
      [
        lat,
        lon,
      ],
      13,
      {
        duration:
          0.55,
      },
    );
  }, [
    assignment,
    map,
  ]);

  return null;
}


export default function WorkerLiveMap() {
  const navigate =
    useNavigate();

  const [
    searchParams,
  ] =
    useSearchParams();

  const [
    assignments,
    setAssignments,
  ] =
    useState<Assignment[]>([]);

  const [
    selectedId,
    setSelectedId,
  ] =
    useState<number | null>(
      () => {
        const value =
          Number(
            searchParams.get(
              "assignment",
            ),
          );

        return Number.isFinite(
          value,
        )
          ? value
          : null;
      },
    );

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");


  const loadAssignments =
    useCallback(
      async (
        silent = false,
      ) => {
        if (!silent) {
          setIsLoading(
            true,
          );
        }

        setError("");

        try {
          const response =
            await api.get(
              "/worker/assignments",
            );

          const loaded =
            getAssignments(
              response.data,
            );

          setAssignments(
            loaded,
          );

          setSelectedId(
            (current) => {
              if (
                current
                &&
                loaded.some(
                  (item) =>
                    item.id
                    === current,
                )
              ) {
                return current;
              }

              const active =
                loaded.find(
                  (item) =>
                    [
                      "IN_PROGRESS",
                      "PAUSED",
                      "ASSIGNED",
                      "ACCEPTED",
                    ].includes(
                      norm(
                        item.status,
                      ),
                    ),
                );

              return (
                active?.id
                ??
                loaded[0]?.id
                ??
                null
              );
            },
          );
        } catch (err: any) {
          setError(
            err?.response
              ?.data
              ?.detail
            ??
            "Unable to load assigned maintenance locations.",
          );
        } finally {
          if (!silent) {
            setIsLoading(
              false,
            );
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
  }, [
    loadAssignments,
  ]);


  const mappableAssignments =
    useMemo(
      () =>
        assignments
          .filter(
            (assignment) => {
              const job =
                getJob(
                  assignment,
                );

              const lat =
                Number(
                  job?.latitude,
                );

              const lon =
                Number(
                  job?.longitude,
                );

              return (
                Number.isFinite(
                  lat,
                )
                &&
                Number.isFinite(
                  lon,
                )
                &&
                lat
                >= 6
                &&
                lat
                <= 38
                &&
                lon
                >= 67
                &&
                lon
                <= 98
              );
            },
          )
          .filter(
            (assignment) =>
              norm(
                assignment.status,
              )
              !== "COMPLETED",
          ),
      [
        assignments,
      ],
    );


  const selectedAssignment =
    useMemo(
      () =>
        assignments.find(
          (item) =>
            item.id
            === selectedId,
        )
        ??
        null,
      [
        assignments,
        selectedId,
      ],
    );


  const selectedJob =
    selectedAssignment
      ? getJob(
          selectedAssignment,
        )
      : null;


  const mapCenter:
    LatLngExpression =
      selectedJob
        &&
        Number.isFinite(
          Number(
            selectedJob.latitude,
          ),
        )
        &&
        Number.isFinite(
          Number(
            selectedJob.longitude,
          ),
        )
        ? [
            Number(
              selectedJob.latitude,
            ),
            Number(
              selectedJob.longitude,
            ),
          ]
        : [
            20.6,
            78.9,
          ];


  return (
    <main
      style={{
        minHeight:
          "100vh",

        background:
          "#f4efe5",

        color:
          "#16394d",
      }}
    >
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
            "0 26px",

          background:
            "#103249",

          color:
            "#fff",

          borderBottom:
            "3px solid #d56a2d",
        }}
      >
        <div
          style={{
            display:
              "flex",

            alignItems:
              "center",

            gap:
              12,
          }}
        >
          <button
            type="button"
            onClick={() =>
              navigate(
                "/worker/tasks",
              )
            }
            style={{
              width:
                38,

              height:
                38,

              display:
                "grid",

              placeItems:
                "center",

              border:
                "1px solid rgba(255,255,255,.18)",

              borderRadius:
                8,

              background:
                "rgba(255,255,255,.06)",

              color:
                "#fff",

              cursor:
                "pointer",
            }}
          >
            <ArrowLeft
              size={
                18
              }
            />
          </button>

          <div>
            <strong
              style={{
                display:
                  "block",

                fontFamily:
                  "Georgia, serif",

                fontSize:
                  25,
              }}
            >
              Worker Live Map
            </strong>

            <span
              style={{
                display:
                  "block",

                marginTop:
                  2,

                color:
                  "#b8cad5",

                fontSize:
                  9,

                fontWeight:
                  900,

                letterSpacing:
                  ".15em",
              }}
            >
              ASSIGNED MAINTENANCE LOCATIONS · DEMO REPLAY
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadAssignments()
          }
          style={{
            height:
              40,

            display:
              "flex",

            alignItems:
              "center",

            gap:
              7,

            padding:
              "0 12px",

            border:
              0,

            borderRadius:
              7,

            background:
              "rgba(255,255,255,.09)",

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
              15
            }
          />

          Refresh
        </button>
      </header>


      <section
        style={{
          maxWidth:
            1500,

          margin:
            "0 auto",

          padding:
            "18px 22px 30px",
        }}
      >
        {error
          && (
            <div
              style={{
                marginBottom:
                  12,

                padding:
                  "10px 12px",

                border:
                  "1px solid #eac0b2",

                borderRadius:
                  7,

                background:
                  "#fff0ea",

                color:
                  "#99452e",

                fontSize:
                  11,

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
                error
              }
            </div>
          )}


        <section
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "minmax(0, 2.15fr) minmax(320px, .85fr)",

            gap:
              14,
          }}
        >
          <article
            style={{
              overflow:
                "hidden",

              border:
                "1px solid #dfd2c1",

              borderRadius:
                10,

              background:
                "#fffdf9",
            }}
          >
            <div
              style={{
                minHeight:
                  62,

                display:
                  "flex",

                alignItems:
                  "center",

                justifyContent:
                  "space-between",

                padding:
                  "0 15px",

                borderBottom:
                  "1px solid #e6dbcf",
              }}
            >
              <div>
                <span
                  style={{
                    display:
                      "block",

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
                  ASSIGNED WORK AREA
                </span>

                <h2
                  style={{
                    margin:
                      "2px 0 0",

                    fontFamily:
                      "Georgia, serif",

                    fontSize:
                      20,
                  }}
                >
                  Railway Maintenance Map
                </h2>
              </div>

              <span
                style={{
                  padding:
                    "5px 8px",

                  border:
                    "1px solid #dfc28f",

                  borderRadius:
                    5,

                  background:
                    "#fff3dc",

                  color:
                    "#925c16",

                  fontSize:
                    9,

                  fontWeight:
                    900,
                }}
              >
                DEMO REPLAY
              </span>
            </div>

            <div
              style={{
                height:
                  570,
              }}
            >
              {isLoading
                ? (
                  <div
                    style={{
                      height:
                        "100%",

                      display:
                        "grid",

                      placeItems:
                        "center",

                      color:
                        "#71818a",
                    }}
                  >
                    Loading assignment
                    locations...
                  </div>
                )
                : (
                  <MapContainer
                    center={
                      mapCenter
                    }
                    zoom={
                      selectedJob
                        ? 12
                        : 5
                    }
                    minZoom={
                      4
                    }
                    maxZoom={
                      16
                    }
                    scrollWheelZoom
                    style={{
                      height:
                        "100%",

                      width:
                        "100%",
                    }}
                  >
                    <TileLayer
                      attribution="© OpenStreetMap contributors"
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    <TileLayer
                      attribution="OpenRailwayMap"
                      url="https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png"
                      opacity={
                        0.8
                      }
                    />

                    <FocusSelected
                      assignment={
                        selectedAssignment
                      }
                    />

                    {
                      mappableAssignments.map(
                        (
                          assignment,
                        ) => {
                          const job =
                            getJob(
                              assignment,
                            );

                          const lat =
                            Number(
                              job
                                ?.latitude,
                            );

                          const lon =
                            Number(
                              job
                                ?.longitude,
                            );

                          const style =
                            severityColor(
                              job
                                ?.severity,
                            );

                          const selected =
                            assignment.id
                            === selectedId;

                          return (
                            <CircleMarker
                              key={
                                assignment.id
                              }
                              center={[
                                lat,
                                lon,
                              ]}
                              radius={
                                selected
                                  ? 11
                                  : 7
                              }
                              pathOptions={{
                                color:
                                  selected
                                    ? "#123e57"
                                    : style.stroke,

                                fillColor:
                                  style.fill,

                                fillOpacity:
                                  0.9,

                                weight:
                                  selected
                                    ? 4
                                    : 2,
                              }}
                              eventHandlers={{
                                click:
                                  () =>
                                    setSelectedId(
                                      assignment.id,
                                    ),
                              }}
                            >
                              <Popup>
                                <div
                                  style={{
                                    minWidth:
                                      215,
                                  }}
                                >
                                  <strong>
                                    {
                                      job
                                        ?.job_code
                                      ??
                                      `Assignment ${assignment.id}`
                                    }
                                  </strong>

                                  <div
                                    style={{
                                      marginTop:
                                        5,
                                    }}
                                  >
                                    {
                                      job
                                        ?.title
                                      ??
                                      "Maintenance assignment"
                                    }
                                  </div>

                                  <div
                                    style={{
                                      marginTop:
                                        7,

                                      fontSize:
                                        11,
                                    }}
                                  >
                                    Severity:{" "}
                                    <b>
                                      {
                                        job
                                          ?.severity
                                        ??
                                        "—"
                                      }
                                    </b>
                                    <br />

                                    Status:{" "}
                                    <b>
                                      {
                                        assignment
                                          .status
                                        ??
                                        "—"
                                      }
                                    </b>
                                    <br />

                                    KM:{" "}
                                    <b>
                                      {
                                        job
                                          ?.km_marker
                                        ??
                                        "—"
                                      }
                                    </b>
                                  </div>
                                </div>
                              </Popup>
                            </CircleMarker>
                          );
                        },
                      )
                    }
                  </MapContainer>
                )}
            </div>
          </article>


          <article
            style={{
              minHeight:
                634,

              border:
                "1px solid #dfd2c1",

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
                  62,

                display:
                  "flex",

                alignItems:
                  "center",

                gap:
                  9,

                padding:
                  "0 15px",

                borderBottom:
                  "1px solid #e6dbcf",
              }}
            >
              <MapPinned
                size={
                  18
                }
              />

              <div>
                <span
                  style={{
                    display:
                      "block",

                    color:
                      "#9b5d20",

                    fontSize:
                      9,

                    fontWeight:
                      900,

                    letterSpacing:
                      ".13em",
                  }}
                >
                  SELECTED ASSIGNMENT
                </span>

                <h2
                  style={{
                    margin:
                      "2px 0 0",

                    fontFamily:
                      "Georgia, serif",

                    fontSize:
                      20,
                  }}
                >
                  Field Location
                </h2>
              </div>
            </div>

            {!selectedAssignment
              ? (
                <div
                  style={{
                    padding:
                      25,

                    color:
                      "#71818a",
                  }}
                >
                  No assigned maintenance
                  location available.
                </div>
              )
              : (
                <div
                  style={{
                    padding:
                      15,
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
                    }}
                  >
                    <span
                      style={{
                        padding:
                          "4px 7px",

                        borderRadius:
                          4,

                        background:
                          severityColor(
                            selectedJob
                              ?.severity,
                          ).fill,

                        color:
                          "#fff",

                        fontSize:
                          8,

                        fontWeight:
                          900,
                      }}
                    >
                      {
                        selectedJob
                          ?.severity
                        ??
                        "—"
                      }
                    </span>

                    <span
                      style={{
                        padding:
                          "4px 7px",

                        borderRadius:
                          4,

                        background:
                          "#edf2f3",

                        color:
                          "#4f6977",

                        fontSize:
                          8,

                        fontWeight:
                          900,
                      }}
                    >
                      {
                        selectedAssignment
                          .status
                        ??
                        "—"
                      }
                    </span>
                  </div>

                  <span
                    style={{
                      display:
                        "block",

                      marginTop:
                        13,

                      color:
                        "#9b5d20",

                      fontSize:
                        10,

                      fontWeight:
                        900,
                    }}
                  >
                    {
                      selectedJob
                        ?.job_code
                      ??
                      `ASSIGNMENT-${selectedAssignment.id}`
                    }
                  </span>

                  <h1
                    style={{
                      margin:
                        "5px 0 8px",

                      fontFamily:
                        "Georgia, serif",

                      fontSize:
                        24,

                      lineHeight:
                        1.08,
                    }}
                  >
                    {
                      selectedJob
                        ?.title
                      ??
                      "Maintenance Assignment"
                    }
                  </h1>

                  <p
                    style={{
                      margin:
                        0,

                      color:
                        "#687982",

                      fontSize:
                        11,

                      lineHeight:
                        1.55,
                    }}
                  >
                    {
                      selectedJob
                        ?.description
                      ??
                      "Assigned railway maintenance work."
                    }
                  </p>

                  <div
                    style={{
                      display:
                        "grid",

                      gap:
                        8,

                      marginTop:
                        15,
                    }}
                  >
                    {[
                      [
                        "Corridor",
                        selectedJob
                          ?.corridor
                          ?.name
                        ??
                        "—",
                      ],

                      [
                        "Track Section",
                        selectedJob
                          ?.segment
                          ?.name
                        ??
                        "—",
                      ],

                      [
                        "KM Marker",
                        String(
                          selectedJob
                            ?.km_marker
                          ??
                          "—",
                        ),
                      ],

                      [
                        "Estimated Time",
                        `${selectedJob?.estimated_minutes ?? "—"} min`,
                      ],

                      [
                        "Progress",
                        `${selectedAssignment.progress_percent ?? 0}%`,
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
                              "9px 10px",

                            border:
                              "1px solid #e3d8ca",

                            borderRadius:
                              6,

                            background:
                              "#f7f3ed",
                          }}
                        >
                          <small
                            style={{
                              display:
                                "block",

                              color:
                                "#7d8a91",

                              fontSize:
                                8,

                              fontWeight:
                                900,

                              letterSpacing:
                                ".09em",
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
                        13,

                      padding:
                        11,

                      borderRadius:
                        7,

                      background:
                        "#edf3f5",

                      color:
                        "#3f6273",

                      fontSize:
                        10,

                      lineHeight:
                        1.5,
                    }}
                  >
                    <Navigation
                      size={
                        14
                      }
                      style={{
                        marginRight:
                          5,

                        verticalAlign:
                          "middle",
                      }}
                    />

                    Map position is the
                    maintenance point
                    supplied by the
                    RailSync operational
                    backend.
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        "/worker/tasks",
                      )
                    }
                    style={{
                      width:
                        "100%",

                      minHeight:
                        42,

                      display:
                        "flex",

                      alignItems:
                        "center",

                      justifyContent:
                        "center",

                      gap:
                        7,

                      marginTop:
                        13,

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

                      fontWeight:
                        900,
                    }}
                  >
                    <Wrench
                      size={
                        15
                      }
                    />

                    Open My Tasks
                  </button>
                </div>
              )}
          </article>
        </section>


        <section
          style={{
            marginTop:
              14,

            display:
              "grid",

            gridTemplateColumns:
              "repeat(3, minmax(0,1fr))",

            gap:
              10,
          }}
        >
          {[
            {
              icon:
                TrainFront,

              label:
                "Railway Layer",

              value:
                "OpenRailwayMap",
            },

            {
              icon:
                MapPinned,

              label:
                "Visible Assignments",

              value:
                mappableAssignments.length,
            },

            {
              icon:
                Clock3,

              label:
                "Refresh Cycle",

              value:
                "12 sec",
            },
          ].map(
            ({
              icon:
                Icon,
              label,
              value,
            }) => (
              <article
                key={
                  label
                }
                style={{
                  minHeight:
                    66,

                  display:
                    "flex",

                  alignItems:
                    "center",

                  gap:
                    10,

                  padding:
                    "10px 13px",

                  border:
                    "1px solid #dfd2c1",

                  borderRadius:
                    8,

                  background:
                    "#fffdf9",
                }}
              >
                <Icon
                  size={
                    18
                  }
                />

                <div>
                  <small
                    style={{
                      display:
                        "block",

                      color:
                        "#7e8b92",

                      fontSize:
                        8,

                      fontWeight:
                        900,
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
                        3,
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
      </section>
    </main>
  );
}
