import {
  useEffect,
  useRef,
} from "react";

import { useNavigate } from "react-router-dom";
import L from "leaflet";

import "leaflet/dist/leaflet.css";
import "../../styles/railNetworkMap.css";


type Coordinate = [
  number,
  number,
];


type Corridor = {
  id: string;
  name: string;
  route: Coordinate[];
};


type DemoTrain = {
  id: string;
  name: string;
  route: Coordinate[];
  progressOffset: number;
  speedFactor: number;
};


const INDIA_BOUNDS: L.LatLngBoundsExpression = [
  [7.0, 67.5],
  [36.5, 97.5],
];


const corridors: Corridor[] = [
  {
    id: "delhi-chennai",
    name: "Delhi Chennai Corridor",

    route: [
      [28.6139, 77.2090],
      [27.1767, 78.0081],
      [25.4358, 81.8463],
      [23.2599, 77.4126],
      [21.1458, 79.0882],
      [17.3850, 78.4867],
      [13.0827, 80.2707],
    ],
  },

  {
    id: "mumbai-delhi",
    name: "Mumbai Delhi Corridor",

    route: [
      [19.0760, 72.8777],
      [21.1702, 72.8311],
      [22.3072, 73.1812],
      [23.0225, 72.5714],
      [26.9124, 75.7873],
      [28.6139, 77.2090],
    ],
  },

  {
    id: "kolkata-delhi",
    name: "Kolkata Delhi Corridor",

    route: [
      [22.5726, 88.3639],
      [23.7957, 86.4304],
      [25.5941, 85.1376],
      [25.4358, 81.8463],
      [26.4499, 80.3319],
      [27.1767, 78.0081],
      [28.6139, 77.2090],
    ],
  },

  {
    id: "kolkata-chennai",
    name: "Kolkata Chennai Corridor",

    route: [
      [22.5726, 88.3639],
      [20.2961, 85.8245],
      [17.6868, 83.2185],
      [16.5062, 80.6480],
      [13.0827, 80.2707],
    ],
  },

  {
    id: "mumbai-chennai",
    name: "Mumbai Chennai Corridor",

    route: [
      [19.0760, 72.8777],
      [18.5204, 73.8567],
      [17.3850, 78.4867],
      [15.8281, 78.0373],
      [13.0827, 80.2707],
    ],
  },

  {
    id: "mumbai-bengaluru",
    name: "Mumbai Bengaluru Corridor",

    route: [
      [19.0760, 72.8777],
      [18.5204, 73.8567],
      [16.7049, 74.2433],
      [15.3647, 75.1240],
      [12.9716, 77.5946],
    ],
  },

  {
    id: "bengaluru-chennai",
    name: "Bengaluru Chennai Corridor",

    route: [
      [12.9716, 77.5946],
      [12.9165, 79.1325],
      [13.0827, 80.2707],
    ],
  },

  {
    id: "bengaluru-hyderabad",
    name: "Bengaluru Hyderabad Corridor",

    route: [
      [12.9716, 77.5946],
      [14.6819, 77.6006],
      [15.8281, 78.0373],
      [17.3850, 78.4867],
    ],
  },

  {
    id: "hyderabad-nagpur",
    name: "Hyderabad Nagpur Corridor",

    route: [
      [17.3850, 78.4867],
      [19.2183, 79.1624],
      [21.1458, 79.0882],
    ],
  },

  {
    id: "nagpur-kolkata",
    name: "Nagpur Kolkata Corridor",

    route: [
      [21.1458, 79.0882],
      [21.2514, 81.6296],
      [22.2604, 84.8536],
      [22.5726, 88.3639],
    ],
  },

  {
    id: "ahmedabad-mumbai",
    name: "Ahmedabad Mumbai Corridor",

    route: [
      [23.0225, 72.5714],
      [22.3072, 73.1812],
      [21.1702, 72.8311],
      [19.0760, 72.8777],
    ],
  },

  {
    id: "jaipur-delhi",
    name: "Jaipur Delhi Corridor",

    route: [
      [26.9124, 75.7873],
      [27.5530, 76.6346],
      [28.6139, 77.2090],
    ],
  },

  {
    id: "lucknow-delhi",
    name: "Lucknow Delhi Corridor",

    route: [
      [26.8467, 80.9462],
      [27.1767, 78.0081],
      [28.6139, 77.2090],
    ],
  },

  {
    id: "patna-kolkata",
    name: "Patna Kolkata Corridor",

    route: [
      [25.5941, 85.1376],
      [24.7914, 85.0002],
      [23.7957, 86.4304],
      [22.5726, 88.3639],
    ],
  },

  {
    id: "guwahati-kolkata",
    name: "Guwahati Kolkata Corridor",

    route: [
      [26.1445, 91.7362],
      [25.5788, 91.8933],
      [24.8170, 92.8000],
      [22.5726, 88.3639],
    ],
  },

  {
    id: "chennai-kochi",
    name: "Chennai Kochi Corridor",

    route: [
      [13.0827, 80.2707],
      [11.0168, 76.9558],
      [10.7905, 78.7047],
      [9.9312, 76.2673],
    ],
  },

  {
    id: "kochi-thiruvananthapuram",
    name: "Kerala South Corridor",

    route: [
      [9.9312, 76.2673],
      [9.5916, 76.5222],
      [8.8932, 76.6141],
      [8.5241, 76.9366],
    ],
  },

  {
    id: "chennai-madurai",
    name: "Tamil Nadu South Corridor",

    route: [
      [13.0827, 80.2707],
      [12.9165, 79.1325],
      [10.7905, 78.7047],
      [9.9252, 78.1198],
    ],
  },
];


const cities = [
  {
    name: "New Delhi",
    lat: 28.6139,
    lng: 77.2090,
  },
  {
    name: "Mumbai",
    lat: 19.0760,
    lng: 72.8777,
  },
  {
    name: "Kolkata",
    lat: 22.5726,
    lng: 88.3639,
  },
  {
    name: "Chennai",
    lat: 13.0827,
    lng: 80.2707,
  },
  {
    name: "Bengaluru",
    lat: 12.9716,
    lng: 77.5946,
  },
  {
    name: "Hyderabad",
    lat: 17.3850,
    lng: 78.4867,
  },
];


function buildDemoTrains(): DemoTrain[] {
  const trains: DemoTrain[] = [];

  const trainsPerCorridor = 4;

  corridors.forEach(
    (corridor, corridorIndex) => {
      for (
        let index = 0;
        index < trainsPerCorridor;
        index += 1
      ) {
        trains.push({
          id:
            `${corridor.id}-${index + 1}`,

          name:
            `${corridor.name} ${index + 1}`,

          route:
            index % 2 === 0
              ? corridor.route
              : [...corridor.route].reverse(),

          progressOffset:
            (
              index /
              trainsPerCorridor
              +
              corridorIndex *
                0.073
            ) % 1,

          speedFactor:
            0.82 +
            (
              (
                corridorIndex +
                index
              ) % 5
            ) *
              0.08,
        });
      }
    },
  );

  return trains;
}


const demoTrains =
  buildDemoTrains();


function interpolatePosition(
  route: Coordinate[],
  progress: number,
): Coordinate {
  const segmentCount =
    route.length - 1;

  const scaled =
    progress * segmentCount;

  const segmentIndex =
    Math.min(
      Math.floor(scaled),
      segmentCount - 1,
    );

  const localProgress =
    scaled - segmentIndex;

  const start =
    route[segmentIndex];

  const end =
    route[segmentIndex + 1];


  return [
    start[0] +
      (
        end[0] -
        start[0]
      ) *
        localProgress,

    start[1] +
      (
        end[1] -
        start[1]
      ) *
        localProgress,
  ];
}


function createCityIcon(
  name: string,
) {
  return L.divIcon({
    className:
      "rs-leaflet-city-wrapper",

    html: `
      <div class="rs-leaflet-city">
        <span class="rs-city-point"></span>

        <span class="rs-city-text">
          ${name}
        </span>
      </div>
    `,

    iconSize: [
      90,
      22,
    ],

    iconAnchor: [
      8,
      11,
    ],
  });
}


function createTrainIcon(
  name: string,
) {
  return L.divIcon({
    className:
      "rs-leaflet-train-wrapper",

    html: `
      <div
        class="rs-live-train"
        title="${name}"
      >
        <span class="rs-live-train-pulse"></span>

        <span class="rs-live-train-icon">
          <svg
            viewBox="0 0 24 24"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect
              x="6"
              y="3"
              width="12"
              height="14"
              rx="3"
            />

            <path d="M8 8h8" />

            <circle
              cx="9"
              cy="13"
              r="1"
            />

            <circle
              cx="15"
              cy="13"
              r="1"
            />

            <path d="M8 21l2-4" />
            <path d="M16 21l-2-4" />
          </svg>
        </span>
      </div>
    `,

    iconSize: [
      26,
      26,
    ],

    iconAnchor: [
      13,
      13,
    ],
  });
}


function createIncidentIcon(
  type:
    | "maintenance"
    | "alert",
) {
  return L.divIcon({
    className:
      "rs-incident-wrapper",

    html: `
      <div class="rs-map-incident ${type}">
        ${
          type ===
          "maintenance"
            ? "×"
            : "!"
        }
      </div>
    `,

    iconSize: [
      28,
      28,
    ],

    iconAnchor: [
      14,
      14,
    ],
  });
}


function RailNetworkMap() {
  const navigate = useNavigate();
  const mapElementRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const mapInstanceRef =
    useRef<L.Map | null>(
      null,
    );


  useEffect(() => {
    if (
      !mapElementRef.current ||
      mapInstanceRef.current
    ) {
      return;
    }


    const map =
      L.map(
        mapElementRef.current,
        {
          zoomControl: true,

          attributionControl:
            false,

          scrollWheelZoom:
            false,

          minZoom: 4,

          maxZoom: 18,
        },
      );


    mapInstanceRef.current =
      map;


    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,

        className:
          "rs-base-map-tiles",
      },
    ).addTo(map);


    L.tileLayer(
      "https://tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png",
      {
        maxZoom: 19,

        opacity: 0.95,

        className:
          "rs-railway-map-tiles",
      },
    ).addTo(map);


    map.fitBounds(
      INDIA_BOUNDS,
      {
        paddingTopLeft: [
          10,
          10,
        ],

        paddingBottomRight: [
          125,
          10,
        ],

        animate: false,
      },
    );


    cities.forEach(
      (city) => {
        L.marker(
          [
            city.lat,
            city.lng,
          ],
          {
            icon:
              createCityIcon(
                city.name,
              ),

            interactive: false,
          },
        ).addTo(map);
      },
    );


    L.marker(
      [
        18.5,
        78.2,
      ],
      {
        icon:
          createIncidentIcon(
            "maintenance",
          ),
      },
    )
      .bindTooltip(
        "Demo maintenance block",
      )
      .addTo(map);


    L.marker(
      [
        11.2,
        76.9,
      ],
      {
        icon:
          createIncidentIcon(
            "alert",
          ),
      },
    )
      .bindTooltip(
        "Demo operational alert",
      )
      .addTo(map);


    const trainMarkers =
      demoTrains.map(
        (train) => {
          const initial =
            interpolatePosition(
              train.route,
              train.progressOffset,
            );


          return L.marker(
            initial,
            {
              icon:
                createTrainIcon(
                  train.name,
                ),

              zIndexOffset:
                1000,
            },
          )
            .bindTooltip(
              train.name,
              {
                direction:
                  "top",
              },
            )
            .addTo(map);
        },
      );


    const startedAt =
      performance.now();


    let animationId = 0;


    const animate = (
      timestamp: number,
    ) => {
      const elapsed =
        timestamp -
        startedAt;


      demoTrains.forEach(
        (
          train,
          index,
        ) => {
          const duration =
            60000 /
            train.speedFactor;


          const progress =
            (
              train.progressOffset +
              elapsed /
                duration
            ) % 1;


          const coordinate =
            interpolatePosition(
              train.route,
              progress,
            );


          trainMarkers[
            index
          ].setLatLng(
            coordinate,
          );
        },
      );


      animationId =
        requestAnimationFrame(
          animate,
        );
    };


    animationId =
      requestAnimationFrame(
        animate,
      );


    const resizeTimer =
      window.setTimeout(
        () => {
          map.invalidateSize();

          map.fitBounds(
            INDIA_BOUNDS,
            {
              paddingTopLeft: [
                10,
                10,
              ],

              paddingBottomRight: [
                125,
                10,
              ],

              animate: false,
            },
          );
        },
        250,
      );


    return () => {
      window.clearTimeout(
        resizeTimer,
      );

      cancelAnimationFrame(
        animationId,
      );

      map.remove();

      mapInstanceRef.current =
        null;
    };
  }, []);


  return (
    <section className="rs-map">
      <header className="rs-map-header">
        <div>
          <h3>
            Live Rail Network
          </h3>

          <p>
            <span />

            REAL TRACKS • SIMULATED TRAIN MOTION
          </p>
        </div>


        <button type="button">
          India
          <b>⌄</b>
        </button>
      </header>


      <div className="rs-map-stage">
        <div
          ref={mapElementRef}
          className="rs-leaflet-map"
        />


        <div className="rs-map-legend">
          <div>
            <i className="green" />
            Running Train
          </div>

          <div>
            <i className="red" />
            Under Maintenance
          </div>

          <div>
            <i className="orange" />
            Alert / Incident
          </div>

          <div>
            <i className="white" />
            Major Junction
          </div>

          <div>
            <i className="line" />
            Rail Network
          </div>
        </div>


        <div className="rs-map-stats">
          <article>
            <i className="green" />

            <div>
              <strong>
                {demoTrains.length}
              </strong>

              <span>
                Simulated Trains
              </span>
            </div>
          </article>


          <article>
            <i className="red" />

            <div>
              <strong>
                1
              </strong>

              <span>
                Maintenance
              </span>
            </div>
          </article>


          <article>
            <i className="orange" />

            <div>
              <strong>
                1
              </strong>

              <span>
                Active Alert
              </span>
            </div>
          </article>


          <article>
            <i className="blue" />

            <div>
              <strong>
                REAL
              </strong>

              <span>
                Rail Geometry
              </span>
            </div>
          </article>
        </div>


        <div className="rs-map-source">
          <i />

          Real railway tracks

          <b>•</b>

          72 simulated trains
        </div>
      </div>


      <footer className="rs-map-footer">
        <span>
          OpenStreetMap +
          OpenRailwayMap
        </span>

        <button
          type="button"
          onClick={() => navigate("/public-map")}
        >
          View Full Map
          <b>→</b>
        </button>
      </footer>
    </section>
  );
}


export default RailNetworkMap;