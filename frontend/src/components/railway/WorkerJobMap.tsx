import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";

import {
  useEffect,
  useMemo,
} from "react";

import L from "leaflet";

import "../../styles/workerJobMap.css";


type WorkerJobMapProps = {
  latitude?: number;
  longitude?: number;

  jobTitle?: string;
  jobCode?: string;

  severity?:
    | "LOW"
    | "MEDIUM"
    | "HIGH"
    | "CRITICAL";

  fromStation?: string;
  toStation?: string;
};


type Coordinate = [
  number,
  number
];


function MapFocus({
  position,
}: {
  position: Coordinate;
}) {
  const map = useMap();

  useEffect(
    () => {
      map.flyTo(
        position,
        15,
        {
          duration: 1.2,
        }
      );
    },
    [
      map,
      position,
    ]
  );

  return null;
}


const maintenanceIcon =
  L.divIcon({
    className:
      "railsync-maintenance-marker",

    html:
      `
      <div
        style="
          width:26px;
          height:26px;
          border-radius:50%;
          background:#c93e2f;
          border:4px solid white;
          box-shadow:0 3px 12px rgba(125,30,20,.45);
        "
      ></div>
      `,

    iconSize:
      [
        26,
        26,
      ],

    iconAnchor:
      [
        13,
        13,
      ],
  });


export default function WorkerJobMap({
  latitude,
  longitude,

  jobTitle =
    "Maintenance Job",

  jobCode =
    "—",

  severity =
    "LOW",

  fromStation,

  toStation,
}: WorkerJobMapProps) {

  const jobPosition =
    useMemo<Coordinate>(
      () => [
        latitude
        ?? 12.9360,

        longitude
        ?? 80.1368,
      ],
      [
        latitude,
        longitude,
      ]
    );


  /*
   * In the prototype the backend currently gives us the
   * exact maintenance POINT.
   *
   * Until detailed topology geometry is linked to each
   * assignment, this local visual segment is drawn around
   * that point for operational context.
   */

  const routePoints =
    useMemo<Coordinate[]>(
      () => {
        const [
          lat,
          lon,
        ] = jobPosition;

        return [
          [
            lat - 0.012,
            lon - 0.010,
          ],

          [
            lat - 0.007,
            lon - 0.006,
          ],

          [
            lat - 0.003,
            lon - 0.0025,
          ],

          [
            lat,
            lon,
          ],

          [
            lat + 0.004,
            lon + 0.003,
          ],

          [
            lat + 0.009,
            lon + 0.008,
          ],
        ];
      },
      [
        jobPosition,
      ]
    );


  const maintenanceSegment =
    useMemo<Coordinate[]>(
      () => {
        const [
          lat,
          lon,
        ] = jobPosition;

        return [
          [
            lat - 0.002,
            lon - 0.0016,
          ],

          [
            lat,
            lon,
          ],

          [
            lat + 0.002,
            lon + 0.0016,
          ],
        ];
      },
      [
        jobPosition,
      ]
    );


  return (
    <div
      className="worker-job-map-shell"
    >
      <MapContainer
        center={
          jobPosition
        }
        zoom={15}
        scrollWheelZoom
        className="worker-job-map"
      >
        <MapFocus
          position={
            jobPosition
          }
        />


        {/* Base map */}

        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />


        {/* Railway overlay */}

        <TileLayer
          attribution="OpenRailwayMap"
          url="https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png"
          opacity={0.78}
        />


        {/* Operational corridor */}

        <Polyline
          positions={
            routePoints
          }
          pathOptions={{
            color:
              "#173f57",

            weight:
              5,

            opacity:
              0.72,
          }}
        />


        {/* Maintenance zone */}

        <Polyline
          positions={
            maintenanceSegment
          }
          pathOptions={{
            color:
              "#c83d2f",

            weight:
              9,

            opacity:
              0.9,

            dashArray:
              "8 5",
          }}
        />


        {/* Origin */}

        <CircleMarker
          center={
            routePoints[0]
          }
          radius={6}
          pathOptions={{
            color:
              "#ffffff",

            fillColor:
              "#173f57",

            fillOpacity:
              1,

            weight:
              2,
          }}
        >
          <Tooltip>
            {
              fromStation
              ?? "Section Entry"
            }
          </Tooltip>
        </CircleMarker>


        {/* Destination */}

        <CircleMarker
          center={
            routePoints[
              routePoints.length - 1
            ]
          }
          radius={6}
          pathOptions={{
            color:
              "#ffffff",

            fillColor:
              "#218f4a",

            fillOpacity:
              1,

            weight:
              2,
          }}
        >
          <Tooltip>
            {
              toStation
              ?? "Section Exit"
            }
          </Tooltip>
        </CircleMarker>


        {/* Exact backend maintenance point */}

        <Marker
          position={
            jobPosition
          }
          icon={
            maintenanceIcon
          }
        >
          <Tooltip
            permanent
            direction="top"
            offset={[
              0,
              -12,
            ]}
          >
            {
              jobCode
            }
          </Tooltip>


          <Popup>
            <div
              style={{
                minWidth:
                  180,
              }}
            >
              <strong>
                {
                  jobTitle
                }
              </strong>

              <br />

              Job:{" "}
              {
                jobCode
              }

              <br />

              Severity:{" "}
              {
                severity
              }

              <br />

              Latitude:{" "}
              {
                jobPosition[0]
                  .toFixed(5)
              }

              <br />

              Longitude:{" "}
              {
                jobPosition[1]
                  .toFixed(5)
              }
            </div>
          </Popup>
        </Marker>
      </MapContainer>


      <div
        className="worker-job-map-status"
      >
        <span>
          <i />

          JOB LOCATION
        </span>

        <strong>
          {
            jobCode
          }
        </strong>
      </div>


      <div
        className="worker-job-map-origin"
      >
        {
          fromStation
          ?? "Section Entry"
        }
      </div>


      <div
        className="worker-job-map-destination"
      >
        {
          toStation
          ?? "Section Exit"
        }
      </div>


      <div
        className="worker-job-map-legend"
      >
        <span>
          <i
            className="route"
          />

          Railway Corridor
        </span>

        <span>
          <i
            className="maintenance"
          />

          Maintenance Zone
        </span>
      </div>
    </div>
  );
}