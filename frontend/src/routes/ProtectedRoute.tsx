import {
  Navigate,
  Outlet,
} from "react-router-dom";


import {
  useAuth,
} from "../context/AuthContext";


import type {
  UserRole,
} from "../types/auth";


type ProtectedRouteProps = {
  allowedRoles:
    UserRole[];
};


function ProtectedRoute({
  allowedRoles,
}: ProtectedRouteProps) {
  const {
    user,
    isLoading,
  } =
    useAuth();


  if (isLoading) {
    return (
      <main
        style={{
          minHeight:
            "100vh",

          display:
            "grid",

          placeItems:
            "center",

          background:
            "#f7efe4",

          color:
            "#14283d",
        }}
      >
        <div
          style={{
            textAlign:
              "center",
          }}
        >
          <strong>
            RailSync
          </strong>

          <p>
            Verifying secure session...
          </p>
        </div>
      </main>
    );
  }


  if (!user) {
    return (
      <Navigate
        to="/roles"
        replace
      />
    );
  }


  if (
    !allowedRoles.includes(
      user.role,
    )
  ) {
    if (
      user.role ===
      "WORKER"
    ) {
      return (
        <Navigate
          to="/worker"
          replace
        />
      );
    }


    if (
      user.role ===
      "MANAGER"
    ) {
      return (
        <Navigate
          to="/manager"
          replace
        />
      );
    }


    return (
      <Navigate
        to="/operator"
        replace
      />
    );
  }


  return <Outlet />;
}


export default ProtectedRoute;