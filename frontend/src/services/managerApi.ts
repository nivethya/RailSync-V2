import api from "./api";


export type FaultSeverity =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";


export type JobStatus =
  | "PENDING"
  | "READY_FOR_ASSIGNMENT"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "PAUSED"
  | "EXTENSION_REQUESTED"
  | "COMPLETED"
  | "CANCELLED";


export type ExtensionStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED";


export interface RailwayCorridor {
  id: number;
  corridor_code: string;
  name: string;
  railway_zone: string | null;
  division: string | null;
  source_type: string | null;
}


export interface TrackSegmentSummary {
  id: number;
  segment_code: string;
  name: string;
  from_station_name: string | null;
  to_station_name: string | null;
  track_number: string | null;
  direction: string | null;
}


export interface CorridorSummary {
  id: number;
  corridor_code: string;
  name: string;
}


export interface ManagerMaintenanceJob {
  id: number;
  job_code: string;
  title: string;
  description: string | null;
  asset_type: string;
  job_type: string;
  severity: FaultSeverity;
  status: JobStatus;
  required_skill: string;
  required_authority: string | null;
  estimated_minutes: number;
  priority_score: number | null;
  priority_reason: string | null;
  km_marker: number | null;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  latitude: number | null;
  longitude: number | null;
  segment: TrackSegmentSummary | null;
  corridor: CorridorSummary | null;
}


export interface EligibleWorker {
  worker_id: number;
  user_id: number | null;
  employee_code: string;
  designation: string;
  department: string | null;
  railway_zone: string | null;
  division: string | null;
  home_station_code: string | null;
  home_station_name: string | null;
  years_experience: number | null;
  availability: "AVAILABLE" | "PARTIAL";
  skill_code: string;
  skill_name: string | null;
  authority_code: string | null;
  proficiency_level: number;
  daily_workload_minutes: number;
  remaining_minutes: number;
  max_daily_minutes: number;
  suitability_score: number;
}


export interface EligibleWorkersResponse {
  job_id: number;
  job_code: string;
  required_skill?: string;
  required_authority?: string | null;
  estimated_minutes?: number;
  count: number;
  eligible_workers: EligibleWorker[];
  message?: string;
}


export interface AssignmentResponse {
  message: string;
  assignment_id: number;
  job_id: number;
  job_code: string;
  worker_id: number;
  employee_code: string;
  assignment_status: string;
  job_status: string;
  realtime_event?: string;
}


export interface ExtensionRequestItem {
  id: number;
  maintenance_job_id: number;
  assignment_id: number;
  worker_id: number;
  employee_code: string | null;
  job_code: string | null;
  job_title: string | null;
  requested_minutes: number;
  reason: string;
  status: ExtensionStatus;
  manager_note: string | null;
  created_at: string;
  decided_at: string | null;
}


export interface ExtensionRequestsResponse {
  count: number;
  extension_requests: ExtensionRequestItem[];
}


/* =========================================================
   CORRIDORS
   ========================================================= */


export async function getManagerCorridors() {
  const response = await api.get<{
    count: number;
    corridors: RailwayCorridor[];
  }>(
    "/manager/corridors"
  );

  return response.data;
}


/* =========================================================
   JOBS
   ========================================================= */


export async function getManagerJobs(
  filters?: {
    corridorId?: number;
    severity?: FaultSeverity;
    jobStatus?: JobStatus;
  }
) {
  const params: Record<string, string | number> = {};

  if (filters?.corridorId) {
    params.corridor_id = filters.corridorId;
  }

  if (filters?.severity) {
    params.severity = filters.severity;
  }

  if (filters?.jobStatus) {
    params.job_status = filters.jobStatus;
  }

  const response = await api.get<{
    count: number;
    jobs: ManagerMaintenanceJob[];
  }>(
    "/manager/jobs",
    {
      params,
    }
  );

  return response.data;
}


export async function getManagerJob(
  jobId: number
) {
  const response =
    await api.get<ManagerMaintenanceJob>(
      `/manager/jobs/${jobId}`
    );

  return response.data;
}


/* =========================================================
   ELIGIBLE WORKERS / ASSIGNMENT
   ========================================================= */


export async function getEligibleWorkers(
  jobId: number
) {
  const response =
    await api.get<EligibleWorkersResponse>(
      `/manager/jobs/${jobId}/eligible-workers`
    );

  return response.data;
}


export async function assignWorkerToJob(
  jobId: number,
  workerId: number
) {
  const response =
    await api.post<AssignmentResponse>(
      `/manager/jobs/${jobId}/assign`,
      {
        worker_id: workerId,
      }
    );

  return response.data;
}


/* =========================================================
   EXTENSION REQUESTS
   ========================================================= */


export async function getManagerExtensionRequests() {
  const response =
    await api.get<ExtensionRequestsResponse>(
      "/manager/extension-requests"
    );

  return response.data;
}


export async function approveExtensionRequest(
  requestId: number,
  managerNote?: string
) {
  const response =
    await api.post(
      `/manager/extension-requests/${requestId}/approve`,
      {
        manager_note: managerNote ?? null,
      }
    );

  return response.data;
}


export async function rejectExtensionRequest(
  requestId: number,
  managerNote?: string
) {
  const response =
    await api.post(
      `/manager/extension-requests/${requestId}/reject`,
      {
        manager_note: managerNote ?? null,
      }
    );

  return response.data;
}
