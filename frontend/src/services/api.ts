import axios, {
  AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";


export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  "https://railsync-backend-sayz.onrender.com/api/v1";


export const ACCESS_TOKEN_KEY =
  "railsync_access_token";

export const REFRESH_TOKEN_KEY =
  "railsync_refresh_token";

export const USER_KEY =
  "railsync_user";


/*
 * Backward compatibility:
 * Older RailSync frontend files used "railsync_token".
 * During the migration, accept that value once and copy it
 * into the canonical "railsync_access_token" key.
 */
export const LEGACY_ACCESS_TOKEN_KEY =
  "railsync_token";


export function getAccessToken():
  string | null {
  const currentToken =
    localStorage.getItem(
      ACCESS_TOKEN_KEY,
    );

  if (currentToken) {
    return currentToken;
  }

  const legacyToken =
    localStorage.getItem(
      LEGACY_ACCESS_TOKEN_KEY,
    );

  if (legacyToken) {
    localStorage.setItem(
      ACCESS_TOKEN_KEY,
      legacyToken,
    );

    return legacyToken;
  }

  return null;
}


export function storeAuthTokens(
  accessToken: string,
  refreshToken?: string | null,
) {
  localStorage.setItem(
    ACCESS_TOKEN_KEY,
    accessToken,
  );

  /*
   * Keep the legacy key synchronized temporarily because
   * older RailSync components may still read it.
   */
  localStorage.setItem(
    LEGACY_ACCESS_TOKEN_KEY,
    accessToken,
  );

  if (refreshToken) {
    localStorage.setItem(
      REFRESH_TOKEN_KEY,
      refreshToken,
    );
  }
}


export function clearAuthStorage() {
  localStorage.removeItem(
    ACCESS_TOKEN_KEY,
  );

  localStorage.removeItem(
    LEGACY_ACCESS_TOKEN_KEY,
  );

  localStorage.removeItem(
    REFRESH_TOKEN_KEY,
  );

  localStorage.removeItem(
    USER_KEY,
  );
}


const api =
  axios.create({
    baseURL:
      API_BASE_URL,

    headers: {
      "Content-Type":
        "application/json",
    },
  });


const refreshClient =
  axios.create({
    baseURL:
      API_BASE_URL,

    headers: {
      "Content-Type":
        "application/json",
    },
  });


api.interceptors.request.use(
  (
    config:
      InternalAxiosRequestConfig,
  ) => {
    const token =
      getAccessToken();

    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  },
);


let isRefreshing = false;


let refreshPromise:
  Promise<string | null> |
  null = null;


async function refreshAccessToken():
  Promise<string | null> {
  const refreshToken =
    localStorage.getItem(
      REFRESH_TOKEN_KEY,
    );

  if (!refreshToken) {
    return null;
  }

  try {
    const response =
      await refreshClient.post(
        "/auth/refresh",
        {
          refresh_token:
            refreshToken,
        },
      );

    const newAccessToken =
      response.data
        .access_token as string;

    const newRefreshToken =
      response.data
        .refresh_token as
          | string
          | undefined;

    storeAuthTokens(
      newAccessToken,
      newRefreshToken,
    );

    return newAccessToken;

  } catch {
    clearAuthStorage();

    return null;
  }
}


api.interceptors.response.use(
  (response) =>
    response,

  async (
    error: AxiosError,
  ) => {
    const originalRequest =
      error.config as
        | (
            InternalAxiosRequestConfig & {
              _retry?: boolean;
            }
          )
        | undefined;

    if (
      !originalRequest ||
      error.response?.status !== 401 ||
      originalRequest._retry
    ) {
      return Promise.reject(
        error,
      );
    }

    /*
     * Never attempt token refresh while
     * login or refresh itself is failing.
     */
    if (
      originalRequest.url?.includes(
        "/auth/login",
      ) ||
      originalRequest.url?.includes(
        "/auth/refresh",
      )
    ) {
      return Promise.reject(
        error,
      );
    }

    originalRequest._retry =
      true;

    if (!isRefreshing) {
      isRefreshing = true;

      refreshPromise =
        refreshAccessToken()
          .finally(() => {
            isRefreshing = false;
          });
    }

    const newToken =
      await refreshPromise;

    if (!newToken) {
      window.dispatchEvent(
        new Event(
          "railsync-auth-expired",
        ),
      );

      return Promise.reject(
        error,
      );
    }

    originalRequest.headers.Authorization =
      `Bearer ${newToken}`;

    return api(
      originalRequest,
    );
  },
);


export default api;