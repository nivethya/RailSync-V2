import {
  useState,
} from "react";

import {
  ArrowLeft,
  ArrowRight,
  Bell,
  ChevronDown,
  Home,
  TrainFront,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useAuth,
} from "../../context/AuthContext";

import type {
  UserRole,
} from "../../types/auth";

import "../../styles/roleSelection.css";


type DemoRole =
  | "worker"
  | "manager"
  | "operator";


type RoleSelectionPageProps = {
  demoMode?: boolean;
};


const portals = [
  {
    id:
      "worker" as DemoRole,

    title:
      "Worker Portal",

    description:
      "Access assigned tasks, report issues, update work progress and stay connected on the ground.",

    image:
      "/images/portal-worker.jpg",

    route:
      "/login/worker",

    destination:
      "/worker",

    employeeId:
      "WRK001",

    password:
      "RailSync@123",

    backendRole:
      "WORKER" as UserRole,

    tone:
      "worker",

    button:
      "Enter Worker Portal",
  },

  {
    id:
      "manager" as DemoRole,

    title:
      "Manager Portal",

    description:
      "Monitor network operations, track maintenance progress, manage teams and make data-driven decisions.",

    image:
      "/images/portal-manager.jpg",

    route:
      "/login/manager",

    destination:
      "/manager",

    employeeId:
      "MGR001",

    password:
      "RailSync@123",

    backendRole:
      "MANAGER" as UserRole,

    tone:
      "manager",

    button:
      "Enter Manager Portal",
  },

  {
    id:
      "operator" as DemoRole,

    title:
      "Train Operator Portal",

    description:
      "Access live train operations, view line status, receive alerts and manage operational activities.",

    image:
      "/images/portal-operator.jpg",

    route:
      "/login/operator",

    destination:
      "/operator",

    employeeId:
      "TOP001",

    password:
      "RailSync@123",

    backendRole:
      "TRAIN_OPERATOR" as UserRole,

    tone:
      "operator",

    button:
      "Enter Operator Portal",
  },
];


function RoleSelectionPage({
  demoMode = false,
}: RoleSelectionPageProps) {
  const navigate =
    useNavigate();

  const {
    login,
  } =
    useAuth();

  const [
    openingRole,
    setOpeningRole,
  ] =
    useState<
      DemoRole | null
    >(null);


  const openPortal =
    async (
      portal:
        typeof portals[number],
    ) => {
      if (!demoMode) {
        navigate(
          portal.route,
        );

        return;
      }


      if (openingRole) {
        return;
      }


      try {
        setOpeningRole(
          portal.id,
        );


        const user =
          await login({
            employee_id:
              portal.employeeId,

            password:
              portal.password,

            role:
              portal.backendRole,
          });


        if (
          user.role !==
          portal.backendRole
        ) {
          throw new Error(
            "Role mismatch",
          );
        }


        /*
         * Full reload ensures ProtectedRoute
         * starts with the stored authentication.
         */

        window.location.replace(
          portal.destination,
        );
      } catch (error) {
        console.error(
          "RailSync demo authentication failed:",
          error,
        );

        alert(
          "Unable to open this RailSync demo portal. Please try again.",
        );

        setOpeningRole(
          null,
        );
      }
    };


  return (
    <main className="portal-page">
      <div className="portal-bg" />


      <header className="portal-header">
        <div className="portal-brand">
          <div className="portal-logo-symbol">
            <TrainFront size={28} />
          </div>

          <div>
            <strong>
              RailSync
            </strong>

            <span>
              INDIAN RAILWAYS
            </span>
          </div>

          <div className="portal-brand-motto">
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


        <div className="portal-header-actions">
          <div className="portal-notification">
            <Bell size={18} />
            <span>
              3
            </span>
          </div>


          <div className="header-divider" />


          <div className="portal-indian-railways">
            <div className="ir-circle">
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


          <div className="header-divider" />


          <div className="portal-profile">
            <div className="profile-avatar">
              RK
            </div>

            <div>
              <strong>
                R.K. Sharma
              </strong>

              <span>
                Northern Railway
              </span>
            </div>

            <ChevronDown size={15} />
          </div>
        </div>
      </header>


      <section className="portal-breadcrumb">
        <Home size={14} />

        <span>
          Home
        </span>

        <b>
          ›
        </b>

        <span>
          Login
        </span>

        <b>
          ›
        </b>

        <strong>
          Select Portal
        </strong>
      </section>


      <section className="portal-hero">
        <div className="portal-side-message left">
          <span>
            SAFE TRACKS
          </span>

          <span>
            RELIABLE OPERATIONS
          </span>

          <span>
            A STRONGER TOMORROW
          </span>

          <div className="tricolor-rule">
            <i />
            <i />
            <i />
          </div>
        </div>


        <div className="portal-heading">
          <h1>
            Select Your Portal
          </h1>

          <p>
            Choose the right operational
            workspace for your role.
          </p>

          <div className="portal-heading-line">
            <span />

            <TrainFront size={18} />

            <span />
          </div>
        </div>


        <div className="portal-side-message right">
          <span>
            BUILT FOR
          </span>

          <span>
            A STRONGER
          </span>

          <span>
            INDIAN RAILWAYS
          </span>

          <div className="tricolor-rule">
            <i />
            <i />
            <i />
          </div>
        </div>
      </section>


      <section className="portal-cards">
        {portals.map(
          (
            portal,
          ) => (
            <article
              key={portal.id}
              className={
                `portal-card ${portal.tone}`
              }
            >
              <div
                className="portal-card-image"
                style={{
                  backgroundImage:
                    `url(${portal.image})`,
                }}
              />


              <div className="portal-card-icon">
                <TrainFront size={28} />
              </div>


              <div className="portal-card-content">
                <h2>
                  {portal.title}
                </h2>


                <p>
                  {portal.description}
                </p>


                <button
                  type="button"
                  disabled={
                    openingRole !== null
                  }
                  onClick={() =>
                    openPortal(
                      portal,
                    )
                  }
                >
                  {openingRole ===
                  portal.id
                    ? "Opening Portal..."
                    : portal.button}

                  <ArrowRight size={17} />
                </button>
              </div>
            </article>
          ),
        )}
      </section>


      <div className="portal-back-wrap">
        <button
          type="button"
          className="portal-back-button"
          onClick={() =>
            navigate(
              demoMode
                ? "/demo"
                : "/",
            )
          }
        >
          <ArrowLeft size={17} />

          Back to Home
        </button>
      </div>


      <footer className="portal-footer">
        <div className="portal-footer-brand">
          <TrainFront size={21} />

          <strong>
            RailSync
          </strong>

          <span>
            |
          </span>

          <small>
            Indian Railways
          </small>
        </div>


        <div className="portal-footer-links">
          <span>
            Help
          </span>

          <i />

          <span>
            Support
          </span>

          <i />

          <span>
            Privacy
          </span>

          <i />

          <span>
            Terms
          </span>
        </div>


        <div className="portal-footer-message">
          <span>
            भारत की जीवनरेखा
          </span>

          <strong>
            INDIA'S LIFELINE
          </strong>

          <div className="footer-flag">
            <i />
            <i />
            <i />
          </div>
        </div>
      </footer>
    </main>
  );
}


export default RoleSelectionPage;