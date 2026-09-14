import api, {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  USER_KEY,
} from "./api";

import type {
  LoginRequest,
  LoginResponse,
  RailSyncUser,
} from "../types/auth";


export async function loginUser(
  credentials: LoginRequest,
): Promise<{
  login: LoginResponse;
  user: RailSyncUser;
}> {
  const loginResponse =
    await api.post<LoginResponse>(
      "/auth/login",
      credentials,
    );


  const login =
    loginResponse.data;


  localStorage.setItem(
    ACCESS_TOKEN_KEY,
    login.access_token,
  );


  localStorage.setItem(
    REFRESH_TOKEN_KEY,
    login.refresh_token,
  );


  try {
    const meResponse =
      await api.get<RailSyncUser>(
        "/auth/me",
      );


    const user =
      meResponse.data;


    localStorage.setItem(
      USER_KEY,
      JSON.stringify(user),
    );


    return {
      login,
      user,
    };
  } catch (error) {
    clearAuthStorage();

    throw error;
  }
}


export async function getCurrentUser():
  Promise<RailSyncUser> {
  const response =
    await api.get<RailSyncUser>(
      "/auth/me",
    );


  localStorage.setItem(
    USER_KEY,
    JSON.stringify(
      response.data,
    ),
  );


  return response.data;
}


export function getStoredUser():
  RailSyncUser | null {
  const stored =
    localStorage.getItem(
      USER_KEY,
    );


  if (!stored) {
    return null;
  }


  try {
    return JSON.parse(
      stored,
    ) as RailSyncUser;
  } catch {
    localStorage.removeItem(
      USER_KEY,
    );

    return null;
  }
}


export function hasAccessToken():
  boolean {
  return Boolean(
    localStorage.getItem(
      ACCESS_TOKEN_KEY,
    ),
  );
}


export function clearAuthStorage():
  void {
  localStorage.removeItem(
    ACCESS_TOKEN_KEY,
  );

  localStorage.removeItem(
    REFRESH_TOKEN_KEY,
  );

  localStorage.removeItem(
    USER_KEY,
  );
}