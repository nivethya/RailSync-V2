export type UserRole =
  | "WORKER"
  | "MANAGER"
  | "TRAIN_OPERATOR";


export interface RailSyncUser {
  id: number;
  employee_id: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  zone: string | null;
  division: string | null;
  is_active: boolean;
}


export interface LoginRequest {
  employee_id: string;
  password: string;
  role: UserRole;
}


export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;

  user_id: number;
  employee_id: string;
  full_name: string;
  role: UserRole;
}


export interface RefreshResponse
  extends LoginResponse {}