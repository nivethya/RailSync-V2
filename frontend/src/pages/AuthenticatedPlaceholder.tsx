import {
  LogOut,
  ShieldCheck,
  TrainFront,
} from "lucide-react";


import {
  useAuth,
} from "../context/AuthContext";


type Props = {
  portal:
    "Worker"
    | "Manager"
    | "Train Operator";
};


function AuthenticatedPlaceholder({
  portal,
}: Props) {
  const {
    user,
    logout,
  } =
    useAuth();


  return (
    <main
      style={{
        minHeight:
          "100vh",

        display:
          "grid",

        placeItems:
          "center",

        padding:
          "30px",

        background:
          "linear-gradient(135deg,#f8f1e7,#eadac5)",

        color:
          "#14283d",
      }}
    >
      <section
        style={{
          width:
            "min(700px,100%)",

          padding:
            "38px",

          borderRadius:
            "22px",

          background:
            "rgba(255,252,247,.96)",

          boxShadow:
            "0 25px 60px rgba(40,28,18,.14)",
        }}
      >
        <TrainFront
          size={38}
        />


        <h1>
          {portal} Dashboard
        </h1>


        <p>
          Frontend authentication
          successfully connected
          to FastAPI.
        </p>


        <hr />


        <p>
          <strong>
            Employee:
          </strong>
          {" "}
          {user?.employee_id}
        </p>


        <p>
          <strong>
            Name:
          </strong>
          {" "}
          {user?.full_name}
        </p>


        <p>
          <strong>
            Role:
          </strong>
          {" "}
          {user?.role}
        </p>


        <p>
          <strong>
            Division:
          </strong>
          {" "}
          {user?.division ??
            "-"}
        </p>


        <div
          style={{
            display:
              "flex",

            alignItems:
              "center",

            gap:
              "8px",

            marginTop:
              "20px",

            color:
              "#39704a",
          }}
        >
          <ShieldCheck
            size={18}
          />

          JWT authenticated
          and role verified
        </div>


        <button
          type="button"
          onClick={
            logout
          }
          style={{
            marginTop:
              "24px",

            display:
              "flex",

            alignItems:
              "center",

            gap:
              "8px",

            padding:
              "12px 18px",

            border:
              "none",

            borderRadius:
              "10px",

            background:
              "#1b2c3a",

            color:
              "white",
          }}
        >
          <LogOut
            size={17}
          />

          Logout
        </button>
      </section>
    </main>
  );
}


export default AuthenticatedPlaceholder;