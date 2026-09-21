import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import axios from "axios";

import {
  Activity,
  ArrowRight,
  BadgeCheck,
  ClipboardList,
  Clock3,
  Eye,
  EyeOff,
  Gauge,
  HardHat,
  Home,
  KeyRound,
  LockKeyhole,
  MapPinned,
  Network,
  RadioTower,
  Route,
  ShieldCheck,
  TrainFront,
  UserRound,
  UsersRound,
  Wrench,
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

import "../../styles/login.css";


type LoginRole =
  | "worker"
  | "manager"
  | "operator";


type LoginPageProps = {
  roleType: LoginRole;
};


const DEMO_MODE_KEY =
  "railsync_demo_mode";


const roleConfig = {
  worker: {
    title:
      "Worker Login",

    subtitle:
      "Access assigned maintenance tasks and shift operations.",

    image:
      "/images/portal-worker.jpg",

    accent:
      "worker",

    backendRole:
      "WORKER" as UserRole,

    employeePlaceholder:
      "WRK001",

    destination:
      "/worker",

    demoEmployeeId:
      "WRK001",

    demoPassword:
      "RailSync@123",

    HeroIcon:
      HardHat,

    features: [
      {
        Icon:
          ClipboardList,

        title:
          "Assigned Tasks",

        description:
          "View and update your work items",
      },

      {
        Icon:
          Clock3,

        title:
          "Shift Sync",

        description:
          "Check schedules and report status",
      },

      {
        Icon:
          ShieldCheck,

        title:
          "Authorized Work Only",

        description:
          "Operate within your assigned role",
      },
    ],
  },


  manager: {
    title:
      "Manager Login",

    subtitle:
      "Coordinate maintenance teams, priorities, blocks and execution.",

    image:
      "/images/portal-manager.jpg",

    accent:
      "manager",

    backendRole:
      "MANAGER" as UserRole,

    employeePlaceholder:
      "MGR001",

    destination:
      "/manager",

    demoEmployeeId:
      "MGR001",

    demoPassword:
      "RailSync@123",

    HeroIcon:
      Wrench,

    features: [
      {
        Icon:
          UsersRound,

        title:
          "Workforce Control",

        description:
          "Manage workers and assignments",
      },

      {
        Icon:
          Gauge,

        title:
          "AI Priority",

        description:
          "Review maintenance priorities",
      },

      {
        Icon:
          Network,

        title:
          "Block Planning",

        description:
          "Coordinate railway maintenance blocks",
      },
    ],
  },


  operator: {
    title:
      "Train Operator Login",

    subtitle:
      "Monitor train operations, disruptions and route decisions.",

    image:
      "/images/portal-operator.jpg",

    accent:
      "operator",

    backendRole:
      "TRAIN_OPERATOR" as UserRole,

    employeePlaceholder:
      "TOP001",

    destination:
      "/operator",

    demoEmployeeId:
      "TOP001",

    demoPassword:
      "RailSync@123",

    HeroIcon:
      RadioTower,

    features: [
      {
        Icon:
          Activity,

        title:
          "Live Operations",

        description:
          "Monitor operational railway status",
      },

      {
        Icon:
          Route,

        title:
          "Route Decisions",

        description:
          "Review alternative movement plans",
      },

      {
        Icon:
          MapPinned,

        title:
          "Incident Control",

        description:
          "Manage disruption and track events",
      },
    ],
  },
};


function LoginPage({
  roleType,
}: LoginPageProps) {
  const navigate =
    useNavigate();


  const {
    login,
  } =
    useAuth();


  const config =
    roleConfig[
      roleType
    ];


  const demoLoginStarted =
    useRef(false);


  const isDemoMode =
    sessionStorage.getItem(
      DEMO_MODE_KEY,
    ) === "true";


  const [
    employeeId,
    setEmployeeId,
  ] =
    useState("");


  const [
    password,
    setPassword,
  ] =
    useState("");


  const [
    showPassword,
    setShowPassword,
  ] =
    useState(false);


  const [
    rememberMe,
    setRememberMe,
  ] =
    useState(false);


  const [
    isSubmitting,
    setIsSubmitting,
  ] =
    useState(false);


  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");


  useEffect(() => {
    if (
      !isDemoMode ||
      demoLoginStarted.current
    ) {
      return;
    }


    demoLoginStarted.current =
      true;


    const runDemoLogin =
      async () => {
        try {
          const user =
            await login({
              employee_id:
                config.demoEmployeeId,

              password:
                config.demoPassword,

              role:
                config.backendRole,
            });


          if (
            user.role !==
            config.backendRole
          ) {
            sessionStorage.removeItem(
              DEMO_MODE_KEY,
            );

            navigate(
              `/login/${roleType}`,
              {
                replace:
                  true,
              },
            );

            return;
          }


          navigate(
            config.destination,
            {
              replace:
                true,
            },
          );
        } catch (error) {
          console.error(
            "RailSync demo authentication failed:",
            error,
          );


          sessionStorage.removeItem(
            DEMO_MODE_KEY,
          );


          navigate(
            `/login/${roleType}`,
            {
              replace:
                true,
            },
          );
        }
      };


    runDemoLogin();
  }, [
    config.backendRole,
    config.demoEmployeeId,
    config.demoPassword,
    config.destination,
    isDemoMode,
    login,
    navigate,
    roleType,
  ]);


  const handleSubmit =
    async (
      event:
        FormEvent,
    ) => {
      event.preventDefault();


      if (
        isSubmitting
      ) {
        return;
      }


      setErrorMessage("");

      setIsSubmitting(
        true,
      );


      try {
        const user =
          await login({
            employee_id:
              employeeId.trim(),

            password,

            role:
              config.backendRole,
          });


        if (
          user.role !==
          config.backendRole
        ) {
          setErrorMessage(
            "This account is not authorized for the selected RailSync portal.",
          );

          return;
        }


        navigate(
          config.destination,
          {
            replace:
              true,
          },
        );
      } catch (error) {
        if (
          axios.isAxiosError(
            error,
          )
        ) {
          const responseData =
            error.response
              ?.data as
              | {
                  detail?:
                    string;
                }
              | undefined;


          const detail =
            responseData
              ?.detail;


          if (
            error.response
              ?.status ===
            401
          ) {
            setErrorMessage(
              detail ??
                "Invalid employee ID, password, or role.",
            );
          } else if (
            error.response
              ?.status ===
            403
          ) {
            setErrorMessage(
              detail ??
                "This account is not permitted to access this portal.",
            );
          } else if (
            !error.response
          ) {
            setErrorMessage(
              "Cannot connect to the RailSync backend. Make sure FastAPI is running.",
            );
          } else {
            setErrorMessage(
              detail ??
                "Login failed. Please try again.",
            );
          }
        } else {
          setErrorMessage(
            "Unexpected login error.",
          );
        }
      } finally {
        setIsSubmitting(
          false,
        );
      }
    };


  /*
   * Demo mode:
   *
   * Do not display the login page at all.
   * The real RailSync authentication runs silently.
   */
  if (
    isDemoMode
  ) {
    return (
      <main
        style={{
          width:
            "100vw",

          height:
            "100vh",

          background:
            "#f7f4ee",
        }}
      />
    );
  }


  return (
    <main
      className={
        `rail-login-page ${config.accent}`
      }
      style={{
        backgroundImage:
          `url(${config.image})`,
      }}
    >
      <div className="rail-login-shade" />


      <header className="rail-login-header">
        <div className="rail-login-brand">
          <div className="rail-login-logo">
            <TrainFront
              size={31}
            />
          </div>

          <div className="rail-login-brand-name">
            <strong>
              RailSync
            </strong>

            <span>
              INDIAN RAILWAYS
            </span>
          </div>

          <div className="rail-login-brand-divider" />

          <div className="rail-login-motto">
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


        <div className="rail-login-header-right">
          <div className="rail-login-ir">
            <div className="rail-login-ir-logo">
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


          <div className="rail-login-header-divider" />


          <button
            type="button"
            className="rail-login-home"
            onClick={() =>
              navigate("/")
            }
          >
            <Home
              size={17}
            />

            Back to Home
          </button>
        </div>
      </header>


      <section className="rail-login-content">
        <div className="rail-login-photo-message">
          <div className="rail-login-photo-badge">
            <config.HeroIcon
              size={18}
            />

            RAILSYNC OPERATIONS
          </div>


          <div className="rail-login-photo-copy">
            <span>
              SAFE • SMART • CONNECTED
            </span>

            <h1>
              Keep India
              <br />
              Moving.
            </h1>

            <p>
              Intelligent railway
              maintenance and
              operational coordination
              for safer, more reliable
              train movement.
            </p>
          </div>
        </div>


        <section className="rail-login-card">
          <div className="rail-login-card-brand">
            <div className="rail-login-card-logo">
              <TrainFront
                size={38}
              />
            </div>

            <div>
              <strong>
                RailSync
              </strong>

              <span>
                INDIAN RAILWAYS
              </span>
            </div>
          </div>


          <h2>
            {
              config.title
            }
          </h2>

          <p className="rail-login-subtitle">
            {
              config.subtitle
            }
          </p>


          <form
            onSubmit={
              handleSubmit
            }
          >
            <label className="rail-login-input">
              <UserRound
                size={19}
              />

              <span className="rail-login-input-divider" />

              <input
                type="text"
                value={
                  employeeId
                }
                onChange={(
                  event,
                ) =>
                  setEmployeeId(
                    event.target
                      .value,
                  )
                }
                placeholder="Employee ID"
                autoComplete="username"
                required
              />

              <small>
                e.g.
                {" "}
                {
                  config.employeePlaceholder
                }
              </small>
            </label>


            <label className="rail-login-input">
              <KeyRound
                size={19}
              />

              <span className="rail-login-input-divider" />

              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={
                  password
                }
                onChange={(
                  event,
                ) =>
                  setPassword(
                    event.target
                      .value,
                  )
                }
                placeholder="Password"
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                className="rail-login-eye"
                onClick={() =>
                  setShowPassword(
                    (
                      current,
                    ) =>
                      !current,
                  )
                }
                aria-label="Toggle password visibility"
              >
                {showPassword ? (
                  <EyeOff
                    size={18}
                  />
                ) : (
                  <Eye
                    size={18}
                  />
                )}
              </button>
            </label>


            <div className="rail-login-options">
              <label>
                <input
                  type="checkbox"
                  checked={
                    rememberMe
                  }
                  onChange={(
                    event,
                  ) =>
                    setRememberMe(
                      event.target
                        .checked,
                    )
                  }
                />

                <span>
                  Remember me
                </span>
              </label>


              <button
                type="button"
              >
                Forgot Password?
              </button>
            </div>


            {errorMessage && (
              <div className="rail-login-error">
                {
                  errorMessage
                }
              </div>
            )}


            <button
              type="submit"
              className="rail-login-submit"
              disabled={
                isSubmitting
              }
            >
              <LockKeyhole
                size={17}
              />

              {isSubmitting
                ? "Authenticating..."
                : "Sign In"}

              {!isSubmitting && (
                <ArrowRight
                  size={19}
                />
              )}
            </button>
          </form>


          <div className="rail-login-authorized">
            <span />

            <ShieldCheck
              size={22}
            />

            <div>
              <strong>
                Authorized railway
                personnel only.
              </strong>

              <small>
                This system is for
                official use by Indian
                Railways staff.
              </small>
            </div>

            <span />
          </div>


          <div className="rail-login-feature-grid">
            {config.features.map(
              (
                feature,
              ) => {
                const FeatureIcon =
                  feature.Icon;

                return (
                  <article
                    key={
                      feature.title
                    }
                  >
                    <div className="rail-login-feature-icon">
                      <FeatureIcon
                        size={21}
                      />
                    </div>

                    <div>
                      <strong>
                        {
                          feature.title
                        }
                      </strong>

                      <p>
                        {
                          feature.description
                        }
                      </p>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        </section>
      </section>


      <section className="rail-login-benefits">
        <article>
          <Network
            size={33}
          />

          <div>
            <strong>
              A More Reliable
              Railway Network
            </strong>
          </div>
        </article>


        <i />


        <article>
          <Wrench
            size={28}
          />

          <div>
            <strong>
              Smarter Maintenance
            </strong>

            <span>
              Fewer Failures
            </span>
          </div>
        </article>


        <i />


        <article>
          <ShieldCheck
            size={29}
          />

          <div>
            <strong>
              Higher Safety
            </strong>

            <span>
              For Every Journey
            </span>
          </div>
        </article>


        <i />


        <article>
          <BadgeCheck
            size={29}
          />

          <div>
            <strong>
              Better Asset
              Utilization
            </strong>

            <span>
              Greater Availability
            </span>
          </div>
        </article>


        <i />


        <div className="rail-login-built">
          <span>
            BUILT FOR
          </span>

          <strong>
            A STRONGER
            <br />
            INDIAN RAILWAYS
          </strong>
        </div>
      </section>
    </main>
  );
}


export default LoginPage;