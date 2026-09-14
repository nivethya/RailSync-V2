import {
  Activity,
  ArrowLeft,
  BrainCircuit,
  CalendarClock,
  Gauge,
  ShieldCheck,
  TrainFront,
  Wrench,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

function PublicInsightsPage() {
  const navigate = useNavigate();

  const cards = [
    {
      icon: BrainCircuit,
      title: "AI Maintenance Priority",
      value: "Risk-aware",
      text: "Maintenance jobs are ranked using urgency, asset condition and operational impact.",
    },
    {
      icon: CalendarClock,
      title: "Smart Block Planning",
      value: "Conflict-aware",
      text: "Maintenance windows are coordinated to reduce repeated possession of the same corridor.",
    },
    {
      icon: TrainFront,
      title: "Delay Impact",
      value: "Predicted",
      text: "RailSync estimates disruption impact and helps surface lower-delay operating options.",
    },
    {
      icon: Wrench,
      title: "Multi-Department Clubbing",
      value: "Unified",
      text: "Track, signalling and traction work can be grouped into common maintenance windows.",
    },
    {
      icon: ShieldCheck,
      title: "Safety Rules",
      value: "Human-in-loop",
      text: "Operational recommendations remain subject to railway authority and safety constraints.",
    },
    {
      icon: Gauge,
      title: "Asset Availability",
      value: "Optimized",
      text: "Planning focuses on improving usable asset time while reducing operational disruption.",
    },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f4efe6",
        color: "#10354d",
        padding: 28,
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 28,
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#b54d19",
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: 1.2,
              }}
            >
              <Activity size={16} />
              PUBLIC RAILSYNC INSIGHTS
            </div>

            <h1
              style={{
                margin: "8px 0 6px",
                fontSize: 42,
              }}
            >
              AI & Operational Insights
            </h1>

            <p
              style={{
                margin: 0,
                color: "#63717a",
                maxWidth: 760,
                lineHeight: 1.6,
              }}
            >
              A public overview of the intelligence RailSync uses for maintenance planning,
              disruption handling and coordinated railway operations.
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
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
            gap: 18,
          }}
        >
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <article
                key={card.title}
                style={{
                  background: "#fffaf3",
                  border: "1px solid #dfd1bf",
                  borderRadius: 16,
                  padding: 22,
                  boxShadow: "0 8px 24px rgba(46,37,26,.07)",
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 11,
                    display: "grid",
                    placeItems: "center",
                    background: "#fff0e7",
                    color: "#b54d19",
                    marginBottom: 16,
                  }}
                >
                  <Icon size={21} />
                </div>

                <span
                  style={{
                    color: "#b54d19",
                    fontSize: 12,
                    fontWeight: 900,
                    letterSpacing: 0.8,
                  }}
                >
                  {card.value.toUpperCase()}
                </span>

                <h2
                  style={{
                    margin: "6px 0 8px",
                    fontSize: 23,
                  }}
                >
                  {card.title}
                </h2>

                <p
                  style={{
                    margin: 0,
                    color: "#62717b",
                    lineHeight: 1.6,
                  }}
                >
                  {card.text}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}

export default PublicInsightsPage;
