import { ArrowLeft, MapPinned } from "lucide-react";
import { useNavigate } from "react-router-dom";

import RailNetworkMap from "../components/map/RailNetworkMap";

function PublicMapPage() {
  const navigate = useNavigate();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f4efe6",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 1500,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                color: "#b54d19",
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: 1.2,
              }}
            >
              <MapPinned size={16} />
              PUBLIC NETWORK VIEW
            </div>

            <h1
              style={{
                margin: "6px 0 4px",
                color: "#10354d",
                fontSize: 38,
              }}
            >
              RailSync Live Rail Network
            </h1>

            <p
              style={{
                margin: 0,
                color: "#61717c",
              }}
            >
              Real railway geometry with simulated train movement for the RailSync prototype.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/")}
            style={{
              border: "1px solid #c9b79e",
              background: "#fffaf3",
              color: "#10354d",
              borderRadius: 9,
              padding: "10px 14px",
              fontWeight: 800,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <ArrowLeft size={16} />
            Back Home
          </button>
        </div>

        <div
          style={{
            height: "calc(100vh - 150px)",
            minHeight: 620,
          }}
        >
          <RailNetworkMap />
        </div>
      </div>
    </main>
  );
}

export default PublicMapPage;
