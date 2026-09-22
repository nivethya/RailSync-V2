import {
  useNavigate,
} from "react-router-dom";

import {
  Activity,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CalendarDays,
  Home,
  Map,
  MapPinned,
  Network,
  PlayCircle,
  ShieldCheck,
  TrainFront,
  Users,
  Wrench,
} from "lucide-react";

import RailNetworkMap from "../components/map/RailNetworkMap";

import "../styles/landing.css";


type LandingPageProps = {
  demoMode?: boolean;
};


const features = [
  {
    icon: Wrench,
    title: "Unified Maintenance",
    subtitle: "Bring all departments together",
    role: "manager",
    path: "/login/manager",
  },

  {
    icon: BrainCircuit,
    title: "AI Prioritization",
    subtitle: "Focus on what matters most",
    path: "/public-insights",
  },

  {
    icon: CalendarDays,
    title: "Smart Block Planning",
    subtitle: "Minimize disruption",
    role: "manager",
    path: "/login/manager",
  },

  {
    icon: TrainFront,
    title: "Real-Time Train Visibility",
    subtitle: "Network-wide visibility",
    path: "/public-map",
  },

  {
    icon: Users,
    title: "Coordinated Operations",
    subtitle: "Track, signal & electrical",
    role: "operator",
    path: "/login/operator",
  },
];


const benefits = [
  {
    icon: Network,
    title: "A More Reliable",
    subtitle: "Railway Network",
  },

  {
    icon: Wrench,
    title: "Smarter Maintenance",
    subtitle: "Fewer Failures",
  },

  {
    icon: ShieldCheck,
    title: "Higher Safety",
    subtitle: "For Every Journey",
  },

  {
    icon: Activity,
    title: "Better Asset Utilization",
    subtitle: "Greater Availability",
  },

  {
    icon: Users,
    title: "Coordinated Teams",
    subtitle: "Stronger Operations",
  },
];


function LandingPage({
  demoMode = false,
}: LandingPageProps) {
  const navigate =
    useNavigate();


  const goHome =
    () => {
      navigate(
        demoMode
          ? "/demo"
          : "/",
      );
    };


  const openLogin =
    () => {
      navigate(
        demoMode
          ? "/demo/roles"
          : "/roles",
      );
    };


  const openProtectedArea =
    (
      normalPath: string,
    ) => {
      if (demoMode) {
        navigate(
          "/demo/roles",
        );

        return;
      }

      navigate(
        normalPath,
      );
    };


  return (
    <main className="rail-home">
      <header className="rail-header">
        <div
          className="header-brand"
          onClick={goHome}
          style={{
            cursor: "pointer",
          }}
        >
          <div className="mini-brand-symbol">
            <span />
            <span />
          </div>

          <div className="header-brand-copy">
            <strong>
              RailSync
            </strong>

            <small>
              INDIAN RAILWAYS
            </small>
          </div>

          <div className="header-motto">
            <span>
              MAINTAIN
            </span>

            <span>
              COORDINATE
            </span>

            <span>
              KEEP INDIA MOVING
            </span>
          </div>
        </div>


        <nav className="main-navigation">
          <button
            className="navigation-item active"
            onClick={goHome}
          >
            <Home size={14} />

            Home
          </button>


          <button
            className="navigation-item"
            onClick={() =>
              openProtectedArea(
                "/login/operator",
              )
            }
          >
            <BarChart3 size={14} />

            Operations
          </button>


          <button
            className="navigation-item"
            onClick={() =>
              openProtectedArea(
                "/login/manager",
              )
            }
          >
            <Wrench size={14} />

            Maintenance
          </button>


          <button
            className="navigation-item"
            onClick={() =>
              navigate(
                "/public-map",
              )
            }
          >
            <Network size={14} />

            Network
          </button>


          <button
            className="navigation-item"
            onClick={() =>
              navigate(
                "/public-insights",
              )
            }
          >
            <MapPinned size={14} />

            Insights
          </button>
        </nav>


        <div className="header-actions">
          <div className="railway-identity">
            <div className="railway-roundel">
              IR
            </div>

            <div>
              <strong>
                भारतीय रेल
              </strong>

              <span>
                INDIAN RAILWAYS
              </span>
            </div>
          </div>


          <button
            className="header-login"
            onClick={openLogin}
          >
            <Users size={17} />

            Login

            <ArrowRight size={17} />
          </button>
        </div>
      </header>


      <section className="rail-hero">
        <div className="hero-photo" />

        <div className="hero-gradient" />


        <div className="hero-left-content">
          <div className="large-brand">
            <div className="tricolor-logo">
              <span className="tricolor orange" />

              <span className="tricolor white" />

              <span className="tricolor green" />

              <div className="train-circle">
                <TrainFront size={34} />
              </div>
            </div>

            <div className="large-brand-name">
              RailSync
            </div>
          </div>


          <h1>
            AI-Powered Railway
            <br />
            Operations Platform
          </h1>


          <p className="hero-lead">
            Intelligent maintenance planning,
            real-time train visibility, and
            coordinated railway operations.
          </p>


          <div className="landing-feature-row">
            {features.map(
              (
                feature,
              ) => {
                const Icon =
                  feature.icon;

                return (
                  <article
                    className="landing-feature"
                    key={feature.title}
                    onClick={() => {
                      if (
                        feature.role &&
                        demoMode
                      ) {
                        navigate(
                          "/demo/roles",
                        );

                        return;
                      }

                      navigate(
                        feature.path,
                      );
                    }}
                    style={{
                      cursor: "pointer",
                    }}
                  >
                    <div className="landing-feature-icon">
                      <Icon size={22} />
                    </div>

                    <strong>
                      {feature.title}
                    </strong>

                    <span>
                      {feature.subtitle}
                    </span>
                  </article>
                );
              },
            )}
          </div>


          <div className="hero-buttons">
            <button
              className="map-main-button"
              onClick={() =>
                navigate(
                  "/public-map",
                )
              }
            >
              <Map size={18} />

              View Live Rail Map

              <ArrowRight size={17} />
            </button>


            <button
              className="how-button"
              onClick={() => {
                window.open(
                  "/simulation/index.html",
                  "_blank",
                  "noopener,noreferrer",
                );
              }}
            >
              <PlayCircle size={18} />

              See How RailSync Works
            </button>
          </div>
        </div>


        <aside className="rail-network-panel">
          <RailNetworkMap />
        </aside>


        <div className="rail-motto-card">
          <span>
            भारतीय रेल
          </span>

          <strong>
            INDIA RUNS
            <br />
            ON PEOPLE
            <br />
            WHO KEEP IT
            <br />
            MOVING
          </strong>
        </div>


        <div className="benefits-floating-bar">
          {benefits.map(
            (
              benefit,
            ) => {
              const Icon =
                benefit.icon;

              return (
                <div
                  className="benefit-cell"
                  key={benefit.title}
                >
                  <div className="benefit-symbol">
                    <Icon size={23} />
                  </div>

                  <div>
                    <strong>
                      {benefit.title}
                    </strong>

                    <span>
                      {benefit.subtitle}
                    </span>
                  </div>
                </div>
              );
            },
          )}


          <div className="stronger-railways">
            <span>
              BUILT FOR
            </span>

            <strong>
              A STRONGER
              <br />
              INDIAN RAILWAYS
            </strong>
          </div>
        </div>
      </section>
    </main>
  );
}


export default LandingPage;