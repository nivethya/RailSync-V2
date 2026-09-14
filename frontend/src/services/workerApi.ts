import api from "./api";


export type WorkerAvailability =
  | "AVAILABLE"
  | "PARTIAL"
  | "UNAVAILABLE";


export type AssignmentStatus =
  | "ASSIGNED"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED";


export interface WorkerSkill {
  skill_code: string;
  skill_name: string;
  authority_code: string | null;
  proficiency_level: number;
  is_certified: boolean;
}


export interface WorkerProfile {
  id: number;
  user_id: number;

  employee_code: string;

  designation: string;

  department: string | null;

  railway_zone: string | null;

  division: string | null;

  home_station_code: string | null;

  home_station_name: string | null;

  years_experience: number | null;

  max_daily_minutes: number;

  availability:
    WorkerAvailability | null;

  skills: WorkerSkill[];
}


export interface AssignmentSegment {
  id: number;

  segment_code: string;

  name: string;

  from_station_name: string | null;

  to_station_name: string | null;

  track_number: string | null;

  direction: string | null;
}


export interface MaintenanceJob {
  id: number;

  job_code: string;

  title: string;

  description: string | null;

  asset_type: string;

  job_type: string;

  severity:
    | "LOW"
    | "MEDIUM"
    | "HIGH"
    | "CRITICAL";

  status: string;

  required_skill: string;

  required_authority: string | null;

  estimated_minutes: number;

  priority_score: number | null;

  priority_reason: string | null;

  km_marker: number | null;

  planned_start: string | null;

  planned_end: string | null;

  latitude: number | null;

  longitude: number | null;

  segment: AssignmentSegment | null;
}


export interface WorkerAssignment {
  assignment_id: number;

  assignment_status:
    AssignmentStatus;

  progress_percent: number;

  assigned_at: string | null;

  accepted_at: string | null;

  started_at: string | null;

  paused_at: string | null;

  completed_at: string | null;

  job: MaintenanceJob;
}


export interface WorkerAssignmentsResponse {
  count: number;

  assignments:
    WorkerAssignment[];
}


export interface WorkerWorkLog {
  id: number;

  maintenance_job_id: number;

  assignment_id: number | null;

  action: string;

  message: string | null;

  progress_percent: number | null;

  created_at: string;
}


export interface WorkerWorkLogResponse {
  count: number;

  logs: WorkerWorkLog[];
}


/* =========================================================
   PROFILE
   ========================================================= */

export async function getWorkerProfile() {

  const response =
    await api.get<WorkerProfile>(
      "/worker/me"
    );

  return response.data;
}


/* =========================================================
   ASSIGNMENTS
   ========================================================= */

export async function getWorkerAssignments() {

  const response =
    await api.get<WorkerAssignmentsResponse>(
      "/worker/assignments"
    );

  return response.data;
}


export async function getWorkerAssignment(
  assignmentId: number
) {

  const response =
    await api.get<WorkerAssignment>(
      `/worker/assignments/${assignmentId}`
    );

  return response.data;
}


/* =========================================================
   AVAILABILITY
   ========================================================= */

export async function updateWorkerAvailability(
  availability:
    WorkerAvailability,

  reason?: string
) {

  const response =
    await api.patch(
      "/worker/availability",
      {
        status:
          availability,

        reason:
          reason ?? null,
      }
    );

  return response.data;
}


/* =========================================================
   START
   ========================================================= */

export async function startWorkerJob(
  assignmentId: number
) {

  const response =
    await api.post(
      `/worker/assignments/${assignmentId}/start`
    );

  return response.data;
}


/* =========================================================
   PAUSE
   ========================================================= */

export async function pauseWorkerJob(
  assignmentId: number
) {

  const response =
    await api.post(
      `/worker/assignments/${assignmentId}/pause`
    );

  return response.data;
}


/* =========================================================
   RESUME
   ========================================================= */

export async function resumeWorkerJob(
  assignmentId: number
) {

  const response =
    await api.post(
      `/worker/assignments/${assignmentId}/resume`
    );

  return response.data;
}


/* =========================================================
   PROGRESS
   ========================================================= */

export async function updateWorkerProgress(
  assignmentId: number,

  progressPercent: number,

  message?: string
) {

  const response =
    await api.patch(
      `/worker/assignments/${assignmentId}/progress`,
      {
        progress_percent:
          progressPercent,

        message:
          message ?? null,
      }
    );

  return response.data;
}


/* =========================================================
   COMPLETE
   ========================================================= */

export async function completeWorkerJob(
  assignmentId: number
) {

  const response =
    await api.post(
      `/worker/assignments/${assignmentId}/complete`
    );

  return response.data;
}


/* =========================================================
   EXTENSION REQUEST
   ========================================================= */

export async function requestWorkerExtension(
  assignmentId: number,

  requestedMinutes: number,

  reason: string
) {

  const response =
    await api.post(
      `/worker/assignments/${assignmentId}/extension-request`,
      {
        requested_minutes:
          requestedMinutes,

        reason,
      }
    );

  return response.data;
}


/* =========================================================
   WORK LOG
   ========================================================= */

export async function getWorkerWorkLog() {

  const response =
    await api.get<WorkerWorkLogResponse>(
      "/worker/work-log"
    );

  return response.data;
}