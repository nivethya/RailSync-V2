from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from geoalchemy2.functions import ST_X, ST_Y
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.operations import (
    AssignmentStatus,
    ExtensionRequest,
    ExtensionStatus,
    JobStatus,
    MaintenanceJob,
    WorkerAssignment,
    WorkerAvailability,
    WorkerAvailabilityStatus,
    WorkerProfile,
    WorkLog,
)
from app.models.user import User, UserRole
from app.websocket.realtime_manager import realtime_manager


router = APIRouter(
    prefix="/worker",
    tags=["Worker Operations"],
)


# =========================================================
# REQUEST MODELS
# =========================================================


class ProgressUpdateRequest(BaseModel):
    progress_percent: int = Field(ge=0, le=100)
    message: str | None = None


class ExtensionRequestCreate(BaseModel):
    requested_minutes: int = Field(gt=0, le=240)
    reason: str = Field(min_length=3, max_length=1000)


class AvailabilityUpdateRequest(BaseModel):
    status: WorkerAvailabilityStatus
    reason: str | None = None


# =========================================================
# AUTHORIZATION
# =========================================================


async def require_worker(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role != UserRole.WORKER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Worker access required",
        )

    return current_user


# =========================================================
# PROFILE HELPERS
# =========================================================


async def get_worker_profile(
    db: AsyncSession,
    user_id: int,
) -> WorkerProfile:
    result = await db.execute(
        select(WorkerProfile)
        .options(
            selectinload(WorkerProfile.skills),
            selectinload(WorkerProfile.availability_records),
        )
        .where(WorkerProfile.user_id == user_id)
    )

    worker = result.scalar_one_or_none()

    if not worker:
        raise HTTPException(
            status_code=404,
            detail="Worker profile not found",
        )

    return worker


async def get_job_location(
    db: AsyncSession,
    job: MaintenanceJob,
):
    latitude = None
    longitude = None

    if job.location is not None:
        result = await db.execute(
            select(
                ST_Y(job.location),
                ST_X(job.location),
            )
        )

        row = result.first()

        if row:
            latitude = row[0]
            longitude = row[1]

    return latitude, longitude


async def assignment_to_dict(
    db: AsyncSession,
    assignment: WorkerAssignment,
):
    job_result = await db.execute(
        select(MaintenanceJob)
        .options(
            selectinload(
                MaintenanceJob.track_segment
            )
        )
        .where(
            MaintenanceJob.id
            == assignment.maintenance_job_id
        )
    )

    job = job_result.scalar_one_or_none()

    if not job:
        return None

    latitude, longitude = await get_job_location(
        db,
        job,
    )

    segment = job.track_segment

    return {
        "assignment_id": assignment.id,
        "assignment_status": assignment.status.value,
        "progress_percent": assignment.progress_percent,
        "assigned_at": assignment.assigned_at,
        "accepted_at": assignment.accepted_at,
        "started_at": assignment.started_at,
        "paused_at": assignment.paused_at,
        "completed_at": assignment.completed_at,
        "job": {
            "id": job.id,
            "job_code": job.job_code,
            "title": job.title,
            "description": job.description,
            "asset_type": job.asset_type,
            "job_type": job.job_type,
            "severity": job.severity.value,
            "status": job.status.value,
            "required_skill": job.required_skill,
            "required_authority": job.required_authority,
            "estimated_minutes": job.estimated_minutes,
            "priority_score": job.priority_score,
            "priority_reason": job.priority_reason,
            "km_marker": job.km_marker,
            "planned_start": job.planned_start,
            "planned_end": job.planned_end,
            "latitude": latitude,
            "longitude": longitude,
            "segment": (
                {
                    "id": segment.id,
                    "segment_code": segment.segment_code,
                    "name": segment.name,
                    "from_station_name": segment.from_station_name,
                    "to_station_name": segment.to_station_name,
                    "track_number": segment.track_number,
                    "direction": segment.direction,
                }
                if segment
                else None
            ),
        },
    }


async def get_owned_assignment(
    db: AsyncSession,
    assignment_id: int,
    worker_id: int,
):
    result = await db.execute(
        select(WorkerAssignment)
        .where(
            WorkerAssignment.id == assignment_id,
            WorkerAssignment.worker_id == worker_id,
        )
    )

    assignment = result.scalar_one_or_none()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found for this worker",
        )

    return assignment


# =========================================================
# REALTIME EVENT HELPERS
# =========================================================


async def notify_managers(
    event_type: str,
    current_user: User,
    worker: WorkerProfile,
    **payload,
):
    await realtime_manager.send_to_role(
        UserRole.MANAGER.value,
        {
            "type": event_type,
            "source_role": UserRole.WORKER.value,
            "worker_user_id": current_user.id,
            "worker_id": worker.id,
            "employee_code": worker.employee_code,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **payload,
        },
    )


# =========================================================
# GET WORKER PROFILE
# =========================================================


@router.get("/me")
async def worker_me(
    db: AsyncSession = Depends(get_db),
    current_worker_user: User = Depends(require_worker),
):
    worker = await get_worker_profile(
        db,
        current_worker_user.id,
    )

    availability = None

    if worker.availability_records:
        availability = max(
            worker.availability_records,
            key=lambda item: item.updated_at,
        )

    return {
        "id": worker.id,
        "user_id": worker.user_id,
        "employee_code": worker.employee_code,
        "designation": worker.designation,
        "department": worker.department,
        "railway_zone": worker.railway_zone,
        "division": worker.division,
        "home_station_code": worker.home_station_code,
        "home_station_name": worker.home_station_name,
        "years_experience": worker.years_experience,
        "max_daily_minutes": worker.max_daily_minutes,
        "availability": (
            availability.status.value
            if availability
            else None
        ),
        "skills": [
            {
                "skill_code": skill.skill_code,
                "skill_name": skill.skill_name,
                "authority_code": skill.authority_code,
                "proficiency_level": skill.proficiency_level,
                "is_certified": skill.is_certified,
            }
            for skill in worker.skills
        ],
    }


# =========================================================
# WORKER ASSIGNMENTS
# =========================================================


@router.get("/assignments")
async def get_assignments(
    db: AsyncSession = Depends(get_db),
    current_worker_user: User = Depends(require_worker),
):
    worker = await get_worker_profile(
        db,
        current_worker_user.id,
    )

    result = await db.execute(
        select(WorkerAssignment)
        .where(
            WorkerAssignment.worker_id
            == worker.id
        )
        .order_by(
            WorkerAssignment.assigned_at.desc()
        )
    )

    assignments = result.scalars().all()
    response = []

    for assignment in assignments:
        item = await assignment_to_dict(
            db,
            assignment,
        )

        if item:
            response.append(item)

    return {
        "count": len(response),
        "assignments": response,
    }


# =========================================================
# SINGLE ASSIGNMENT
# =========================================================


@router.get("/assignments/{assignment_id}")
async def get_assignment(
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_worker_user: User = Depends(require_worker),
):
    worker = await get_worker_profile(
        db,
        current_worker_user.id,
    )

    assignment = await get_owned_assignment(
        db,
        assignment_id,
        worker.id,
    )

    return await assignment_to_dict(
        db,
        assignment,
    )


# =========================================================
# UPDATE AVAILABILITY
# =========================================================


@router.patch("/availability")
async def update_availability(
    payload: AvailabilityUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_worker_user: User = Depends(require_worker),
):
    worker = await get_worker_profile(
        db,
        current_worker_user.id,
    )

    availability = WorkerAvailability(
        worker_id=worker.id,
        status=payload.status,
        reason=payload.reason,
    )

    db.add(availability)
    await db.commit()
    await db.refresh(availability)

    await notify_managers(
        "WORKER_AVAILABILITY_CHANGED",
        current_worker_user,
        worker,
        availability_status=availability.status.value,
        reason=payload.reason,
        availability_id=availability.id,
    )

    return {
        "message": "Availability updated",
        "status": availability.status.value,
        "updated_at": availability.updated_at,
    }


# =========================================================
# START JOB
# =========================================================


@router.post("/assignments/{assignment_id}/start")
async def start_job(
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_worker_user: User = Depends(require_worker),
):
    worker = await get_worker_profile(
        db,
        current_worker_user.id,
    )

    assignment = await get_owned_assignment(
        db,
        assignment_id,
        worker.id,
    )

    if assignment.status not in {
        AssignmentStatus.ASSIGNED,
        AssignmentStatus.ACCEPTED,
        AssignmentStatus.PAUSED,
    }:
        raise HTTPException(
            status_code=400,
            detail=(
                "Assignment cannot be started "
                "from its current state"
            ),
        )

    job_result = await db.execute(
        select(MaintenanceJob)
        .where(
            MaintenanceJob.id
            == assignment.maintenance_job_id
        )
    )

    job = job_result.scalar_one_or_none()

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Maintenance job not found",
        )

    now = datetime.now(timezone.utc)

    assignment.status = AssignmentStatus.IN_PROGRESS

    if not assignment.started_at:
        assignment.started_at = now

    assignment.paused_at = None
    job.status = JobStatus.IN_PROGRESS

    if not job.actual_start:
        job.actual_start = now

    db.add(
        WorkLog(
            maintenance_job_id=job.id,
            assignment_id=assignment.id,
            worker_id=worker.id,
            action="STARTED",
            message="Worker started maintenance work.",
            progress_percent=assignment.progress_percent,
        )
    )

    await db.commit()

    await notify_managers(
        "JOB_STARTED",
        current_worker_user,
        worker,
        assignment_id=assignment.id,
        job_id=job.id,
        job_code=job.job_code,
        job_status=job.status.value,
        assignment_status=assignment.status.value,
        progress_percent=assignment.progress_percent,
    )

    return {
        "message": "Job started",
        "assignment_status": assignment.status.value,
        "job_status": job.status.value,
        "started_at": assignment.started_at,
    }


# =========================================================
# PAUSE JOB
# =========================================================


@router.post("/assignments/{assignment_id}/pause")
async def pause_job(
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_worker_user: User = Depends(require_worker),
):
    worker = await get_worker_profile(
        db,
        current_worker_user.id,
    )

    assignment = await get_owned_assignment(
        db,
        assignment_id,
        worker.id,
    )

    if assignment.status != AssignmentStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail="Only an active job can be paused",
        )

    job_result = await db.execute(
        select(MaintenanceJob)
        .where(
            MaintenanceJob.id
            == assignment.maintenance_job_id
        )
    )

    job = job_result.scalar_one_or_none()

    assignment.status = AssignmentStatus.PAUSED
    assignment.paused_at = datetime.now(timezone.utc)

    if job:
        job.status = JobStatus.PAUSED

    db.add(
        WorkLog(
            maintenance_job_id=assignment.maintenance_job_id,
            assignment_id=assignment.id,
            worker_id=worker.id,
            action="PAUSED",
            message="Worker paused maintenance work.",
            progress_percent=assignment.progress_percent,
        )
    )

    await db.commit()

    await notify_managers(
        "JOB_PAUSED",
        current_worker_user,
        worker,
        assignment_id=assignment.id,
        job_id=assignment.maintenance_job_id,
        job_code=job.job_code if job else None,
        job_status=job.status.value if job else None,
        assignment_status=assignment.status.value,
        progress_percent=assignment.progress_percent,
    )

    return {
        "message": "Job paused",
        "assignment_status": assignment.status.value,
    }


# =========================================================
# RESUME JOB
# =========================================================


@router.post("/assignments/{assignment_id}/resume")
async def resume_job(
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_worker_user: User = Depends(require_worker),
):
    worker = await get_worker_profile(
        db,
        current_worker_user.id,
    )

    assignment = await get_owned_assignment(
        db,
        assignment_id,
        worker.id,
    )

    if assignment.status != AssignmentStatus.PAUSED:
        raise HTTPException(
            status_code=400,
            detail="Only a paused job can be resumed",
        )

    job_result = await db.execute(
        select(MaintenanceJob)
        .where(
            MaintenanceJob.id
            == assignment.maintenance_job_id
        )
    )

    job = job_result.scalar_one_or_none()

    assignment.status = AssignmentStatus.IN_PROGRESS
    assignment.paused_at = None

    if job:
        job.status = JobStatus.IN_PROGRESS

    db.add(
        WorkLog(
            maintenance_job_id=assignment.maintenance_job_id,
            assignment_id=assignment.id,
            worker_id=worker.id,
            action="RESUMED",
            message="Worker resumed maintenance work.",
            progress_percent=assignment.progress_percent,
        )
    )

    await db.commit()

    await notify_managers(
        "JOB_RESUMED",
        current_worker_user,
        worker,
        assignment_id=assignment.id,
        job_id=assignment.maintenance_job_id,
        job_code=job.job_code if job else None,
        job_status=job.status.value if job else None,
        assignment_status=assignment.status.value,
        progress_percent=assignment.progress_percent,
    )

    return {
        "message": "Job resumed",
        "assignment_status": assignment.status.value,
    }


# =========================================================
# PROGRESS UPDATE
# =========================================================


@router.patch("/assignments/{assignment_id}/progress")
async def update_progress(
    assignment_id: int,
    payload: ProgressUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_worker_user: User = Depends(require_worker),
):
    worker = await get_worker_profile(
        db,
        current_worker_user.id,
    )

    assignment = await get_owned_assignment(
        db,
        assignment_id,
        worker.id,
    )

    if assignment.status not in {
        AssignmentStatus.IN_PROGRESS,
        AssignmentStatus.PAUSED,
    }:
        raise HTTPException(
            status_code=400,
            detail=(
                "Progress can only be updated "
                "for active or paused jobs"
            ),
        )

    assignment.progress_percent = (
        payload.progress_percent
    )

    db.add(
        WorkLog(
            maintenance_job_id=assignment.maintenance_job_id,
            assignment_id=assignment.id,
            worker_id=worker.id,
            action="PROGRESS_UPDATED",
            message=(
                payload.message
                or (
                    f"Progress updated to "
                    f"{payload.progress_percent}%."
                )
            ),
            progress_percent=payload.progress_percent,
        )
    )

    await db.commit()

    job_result = await db.execute(
        select(MaintenanceJob)
        .where(
            MaintenanceJob.id
            == assignment.maintenance_job_id
        )
    )
    job = job_result.scalar_one_or_none()

    await notify_managers(
        "JOB_PROGRESS_UPDATED",
        current_worker_user,
        worker,
        assignment_id=assignment.id,
        job_id=assignment.maintenance_job_id,
        job_code=job.job_code if job else None,
        assignment_status=assignment.status.value,
        progress_percent=assignment.progress_percent,
        message=payload.message,
    )

    return {
        "message": "Progress updated",
        "progress_percent": assignment.progress_percent,
    }


# =========================================================
# COMPLETE JOB
# =========================================================


@router.post("/assignments/{assignment_id}/complete")
async def complete_job(
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_worker_user: User = Depends(require_worker),
):
    worker = await get_worker_profile(
        db,
        current_worker_user.id,
    )

    assignment = await get_owned_assignment(
        db,
        assignment_id,
        worker.id,
    )

    if assignment.status not in {
        AssignmentStatus.IN_PROGRESS,
        AssignmentStatus.PAUSED,
    }:
        raise HTTPException(
            status_code=400,
            detail=(
                "Only an active or paused assignment "
                "can be completed"
            ),
        )

    job_result = await db.execute(
        select(MaintenanceJob)
        .where(
            MaintenanceJob.id
            == assignment.maintenance_job_id
        )
    )

    job = job_result.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    assignment.status = AssignmentStatus.COMPLETED
    assignment.progress_percent = 100
    assignment.completed_at = now

    if job:
        job.status = JobStatus.COMPLETED
        job.actual_end = now

    db.add(
        WorkLog(
            maintenance_job_id=assignment.maintenance_job_id,
            assignment_id=assignment.id,
            worker_id=worker.id,
            action="COMPLETED",
            message="Worker completed maintenance work.",
            progress_percent=100,
        )
    )

    await db.commit()

    await notify_managers(
        "JOB_COMPLETED",
        current_worker_user,
        worker,
        assignment_id=assignment.id,
        job_id=assignment.maintenance_job_id,
        job_code=job.job_code if job else None,
        job_status=job.status.value if job else None,
        assignment_status=assignment.status.value,
        progress_percent=100,
        completed_at=assignment.completed_at.isoformat()
        if assignment.completed_at
        else None,
    )

    return {
        "message": "Job completed",
        "assignment_status": assignment.status.value,
        "progress_percent": 100,
        "completed_at": assignment.completed_at,
    }


# =========================================================
# REQUEST EXTRA TIME
# =========================================================


@router.post(
    "/assignments/{assignment_id}/extension-request"
)
async def request_extension(
    assignment_id: int,
    payload: ExtensionRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_worker_user: User = Depends(require_worker),
):
    worker = await get_worker_profile(
        db,
        current_worker_user.id,
    )

    assignment = await get_owned_assignment(
        db,
        assignment_id,
        worker.id,
    )

    if assignment.status not in {
        AssignmentStatus.IN_PROGRESS,
        AssignmentStatus.PAUSED,
    }:
        raise HTTPException(
            status_code=400,
            detail=(
                "Extension can only be requested "
                "for an active maintenance assignment"
            ),
        )

    existing_result = await db.execute(
        select(ExtensionRequest)
        .where(
            ExtensionRequest.assignment_id
            == assignment.id,
            ExtensionRequest.status
            == ExtensionStatus.PENDING,
        )
    )

    existing = existing_result.scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=400,
            detail=(
                "A pending extension request "
                "already exists"
            ),
        )

    extension = ExtensionRequest(
        maintenance_job_id=assignment.maintenance_job_id,
        assignment_id=assignment.id,
        worker_id=worker.id,
        requested_minutes=payload.requested_minutes,
        reason=payload.reason,
        status=ExtensionStatus.PENDING,
    )

    db.add(extension)

    job_result = await db.execute(
        select(MaintenanceJob)
        .where(
            MaintenanceJob.id
            == assignment.maintenance_job_id
        )
    )

    job = job_result.scalar_one_or_none()

    if job:
        job.status = JobStatus.EXTENSION_REQUESTED

    db.add(
        WorkLog(
            maintenance_job_id=assignment.maintenance_job_id,
            assignment_id=assignment.id,
            worker_id=worker.id,
            action="EXTENSION_REQUESTED",
            message=(
                f"Worker requested "
                f"{payload.requested_minutes} "
                f"additional minutes."
            ),
            progress_percent=assignment.progress_percent,
        )
    )

    await db.commit()
    await db.refresh(extension)

    await notify_managers(
        "EXTENSION_REQUESTED",
        current_worker_user,
        worker,
        extension_request_id=extension.id,
        assignment_id=assignment.id,
        job_id=assignment.maintenance_job_id,
        job_code=job.job_code if job else None,
        requested_minutes=payload.requested_minutes,
        reason=payload.reason,
        progress_percent=assignment.progress_percent,
    )

    return {
        "message": "Extension request sent to manager",
        "extension_request_id": extension.id,
        "status": extension.status.value,
        "requested_minutes": extension.requested_minutes,
    }


# =========================================================
# WORK LOG HISTORY
# =========================================================


@router.get("/work-log")
async def worker_work_log(
    db: AsyncSession = Depends(get_db),
    current_worker_user: User = Depends(require_worker),
):
    worker = await get_worker_profile(
        db,
        current_worker_user.id,
    )

    result = await db.execute(
        select(WorkLog)
        .where(
            WorkLog.worker_id
            == worker.id
        )
        .order_by(
            WorkLog.created_at.desc()
        )
    )

    logs = result.scalars().all()

    return {
        "count": len(logs),
        "logs": [
            {
                "id": log.id,
                "maintenance_job_id": log.maintenance_job_id,
                "assignment_id": log.assignment_id,
                "action": log.action,
                "message": log.message,
                "progress_percent": log.progress_percent,
                "created_at": log.created_at,
            }
            for log in logs
        ],
    }
