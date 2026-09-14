import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";


import {
  clearAuthStorage,
  getCurrentUser,
  getStoredUser,
  hasAccessToken,
  loginUser,
} from "../services/authService";


import type {
  LoginRequest,
  RailSyncUser,
} from "../types/auth";


type AuthContextValue = {
  user: RailSyncUser | null;

  isAuthenticated: boolean;

  isLoading: boolean;

  login: (
    credentials:
      LoginRequest,
  ) => Promise<RailSyncUser>;

  logout: () => void;
};


const AuthContext =
  createContext<
    AuthContextValue |
    undefined
  >(undefined);


type AuthProviderProps = {
  children: ReactNode;
};


export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [
    user,
    setUser,
  ] =
    useState<RailSyncUser | null>(
      getStoredUser(),
    );


  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);


  const logout =
    useCallback(() => {
      clearAuthStorage();

      setUser(null);
    }, []);


  const login =
    useCallback(
      async (
        credentials:
          LoginRequest,
      ) => {
        const result =
          await loginUser(
            credentials,
          );


        setUser(
          result.user,
        );


        return result.user;
      },
      [],
    );


  useEffect(() => {
    let active = true;


    async function restoreSession() {
      if (!hasAccessToken()) {
        if (active) {
          setUser(null);

          setIsLoading(
            false,
          );
        }

        return;
      }


      try {
        const currentUser =
          await getCurrentUser();


        if (active) {
          setUser(
            currentUser,
          );
        }
      } catch {
        clearAuthStorage();

        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setIsLoading(
            false,
          );
        }
      }
    }


    void restoreSession();


    const handleExpiredAuth =
      () => {
        logout();
      };


    window.addEventListener(
      "railsync-auth-expired",
      handleExpiredAuth,
    );


    return () => {
      active = false;


      window.removeEventListener(
        "railsync-auth-expired",
        handleExpiredAuth,
      );
    };
  }, [logout]);


  return (
    <AuthContext.Provider
      value={{
        user,

        isAuthenticated:
          Boolean(user),

        isLoading,

        login,

        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth():
  AuthContextValue {
  const context =
    useContext(
      AuthContext,
    );


  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider",
    );
  }


  return context;
}