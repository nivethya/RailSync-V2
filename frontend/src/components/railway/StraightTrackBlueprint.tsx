import {
  MapPin,
  RadioTower,
  ShieldCheck,
  TriangleAlert,
  Wrench,
} from "lucide-react";

import "../../styles/straightTrackBlueprint.css";


type StraightTrackBlueprintProps = {
  startStation?: string;
  endStation?: string;
  blockId?: string;
  maintenanceId?: string;
  priority?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
};


function StraightTrackBlueprint({
  startStation = "Tambaram",
  endStation = "Chromepet",
  blockId = "BLK-TBM-CMP-2003",
  maintenanceId = "MT-TRACK-2003",
  priority = "HIGH",
}: StraightTrackBlueprintProps) {
  const sleepers =
    Array.from({
      length: 25,
    });


  return (
    <section className="straight-blueprint">
      {/* TOP INFORMATION */}

      <div className="straight-blueprint-header">
        <div>
          <span className="straight-blueprint-kicker">
            LIVE SECTION BLUEPRINT
          </span>

          <h2>
            {startStation}
            {" – "}
            {endStation}
          </h2>
        </div>


        <div className="straight-live-status">
          <i />

          RAILSYNC LIVE
        </div>
      </div>


      {/* TRACK DRAWING */}

      <div className="straight-track-canvas">
        <div className="straight-grid" />


        {/* START STATION */}

        <div className="straight-station start">
          <MapPin
            size={17}
          />

          <strong>
            {startStation}
          </strong>

          <span>
            SECTION ENTRY
          </span>
        </div>


        {/* END STATION */}

        <div className="straight-station end">
          <MapPin
            size={17}
          />

          <strong>
            {endStation}
          </strong>

          <span>
            SECTION EXIT
          </span>
        </div>


        {/* RAILWAY TRACK */}

        <div className="straight-track-system">
          {/* upper rail */}

          <div className="straight-rail upper" />

          {/* lower rail */}

          <div className="straight-rail lower" />

          {/* center guide */}

          <div className="straight-track-center" />


          {/* sleepers */}

          <div className="straight-sleepers">
            {sleepers.map(
              (
                _,
                index,
              ) => (
                <span
                  key={index}
                  style={{
                    left:
                      `${
                        (index /
                          (sleepers.length -
                            1)) *
                        100
                      }%`,
                  }}
                />
              ),
            )}
          </div>


          {/* ENTRY RING */}

          <div className="straight-end-ring entry" />


          {/* EXIT RING */}

          <div className="straight-end-ring exit" />


          {/* TURNOUT / SWITCH */}

          <div className="straight-turnout">
            <div className="turnout-curve" />

            <div className="turnout-leg" />

            <div className="turnout-signal" />
          </div>


          {/* MAINTENANCE ZONE */}

          <div className="straight-maintenance-zone">
            <div className="maintenance-crosshair horizontal" />

            <div className="maintenance-crosshair vertical" />

            <span>
              MAINTENANCE ZONE
            </span>
          </div>


          {/* MAINTENANCE LABEL */}

          <div className="straight-maintenance-label">
            <Wrench
              size={15}
            />

            <div>
              <strong>
                {maintenanceId}
              </strong>

              <span>
                0% COMPLETE
              </span>
            </div>
          </div>
        </div>


        {/* ENTRY LABEL */}

        <div className="straight-entry-label">
          ENTRY
        </div>


        {/* EXIT LABEL */}

        <div className="straight-exit-label">
          EXIT
        </div>


        {/* CONTROL INFO */}

        <div className="straight-control-info">
          <span>
            <ShieldCheck
              size={15}
            />

            CONTROLLED SECTION
          </span>

          <span>
            <RadioTower
              size={15}
            />

            SIGNAL / CONTROL
          </span>
        </div>
      </div>


      {/* BOTTOM INFORMATION BAR */}

      <div className="straight-blueprint-footer">
        <div>
          <span>
            BLOCK
          </span>

          <strong>
            {blockId}
          </strong>
        </div>


        <div>
          <span>
            STATUS
          </span>

          <strong>
            ASSIGNED
          </strong>
        </div>


        <div>
          <span>
            PRIORITY
          </span>

          <strong>
            {priority}
          </strong>
        </div>


        <div className="straight-critical">
          <TriangleAlert
            size={14}
          />

          CRITICAL ATTENTION
        </div>
      </div>
    </section>
  );
}


export default StraightTrackBlueprint;