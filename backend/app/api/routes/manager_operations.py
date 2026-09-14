from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from geoalchemy2.functions import ST_X, ST_Y
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.operations import (
    AssignmentStatus,
    ExtensionRequest,
    ExtensionStatus,
    JobStatus,
    MaintenanceJob,
    RailwayCorridor,
    TrackSegment,
    WorkerAssignment,
    WorkerAvailability,
    WorkerAvailabilityStatus,
    WorkerProfile,
    WorkerSkill,
    WorkLog,
)
from app.models.user import User, UserRole
from app.services.ml_service import (
    model_status,
    predict_maintenance_priority,
    predict_worker_suitability,
)

from app.websocket.realtime_manager import realtime_manager


router = APIRouter(
    prefix="/manager",
    tags=["Manager Operations"],
)


# =========================================================
# REQUEST MODELS
# =========================================================


class AssignWorkerRequest(BaseModel):
    worker_id: int


class ExtensionDecisionRequest(BaseModel):
    manager_note: str | None = None


# =========================================================
# AUTHORIZATION
# =========================================================


async def require_manager(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role != UserRole.MANAGER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager access required",
        )

    return current_user


# =========================================================
# HELPERS
# =========================================================


async def job_to_dict(
    db: AsyncSession,
    job: MaintenanceJob,
):
    segment = None
    corridor = None

    if job.track_segment_id is not None:
        segment_result = await db.execute(
            select(TrackSegment).where(
                TrackSegment.id == job.track_segment_id
            )
        )
        segment = segment_result.scalar_one_or_none()

        if segment and segment.corridor_id is not None:
            corridor_result = await db.execute(
                select(RailwayCorridor).where(
                    RailwayCorridor.id == segment.corridor_id
                )
            )
            corridor = corridor_result.scalar_one_or_none()

    latitude = None
    longitude = None

    if job.location is not None:
        point_result = await db.execute(
            select(
                ST_Y(job.location),
                ST_X(job.location),
            )
        )

        point = point_result.first()

        if point:
            latitude = point[0]
            longitude = point[1]

    return {
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
        "actual_start": job.actual_start,
        "actual_end": job.actual_end,
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
        "corridor": (
            {
                "id": corridor.id,
                "corridor_code": corridor.corridor_code,
                "name": corridor.name,
            }
            if corridor
            else None
        ),
    }


async def get_worker_user_id(
    db: AsyncSession,
    worker_id: int,
) -> int | None:
    result = await db.execute(
        select(WorkerProfile.user_id).where(
            WorkerProfile.id == worker_id
        )
    )
    return result.scalar_one_or_none()


async def send_worker_event(
    db: AsyncSession,
    worker_id: int,
    event: dict,
):
    worker_user_id = await get_worker_user_id(
        db,
        worker_id,
    )

    if worker_user_id is None:
        return

    await realtime_manager.send_to_user(
        worker_user_id,
        event,
    )


async def get_latest_availability(
    db: AsyncSession,
    worker_id: int,
):
    result = await db.execute(
        select(WorkerAvailability)
        .where(
            WorkerAvailability.worker_id == worker_id
        )
        .order_by(
            WorkerAvailability.updated_at.desc()
        )
        .limit(1)
    )

    return result.scalar_one_or_none()


async def get_today_workload_minutes(
    db: AsyncSession,
    worker_id: int,
) -> int:
    today = datetime.now(timezone.utc).date()

    result = await db.execute(
        select(WorkerAssignment).where(
            WorkerAssignment.worker_id == worker_id,
            WorkerAssignment.status.notin_(
                [
                    AssignmentStatus.CANCELLED,
                ]
            ),
        )
    )

    assignments = result.scalars().all()

    total = 0

    for assignment in assignments:
        job_result = await db.execute(
            select(MaintenanceJob).where(
                MaintenanceJob.id
                == assignment.maintenance_job_id
            )
        )

        job = job_result.scalar_one_or_none()

        if not job:
            continue

        if (
            job.planned_start is not None
            and job.planned_start.date() == today
        ):
            total += int(
                job.estimated_minutes or 0
            )

    return total


async def get_job_or_404(
    db: AsyncSession,
    job_id: int,
) -> MaintenanceJob:
    result = await db.execute(
        select(MaintenanceJob).where(
            MaintenanceJob.id == job_id
        )
    )

    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Maintenance job not found",
        )

    return job


async def get_worker_or_404(
    db: AsyncSession,
    worker_id: int,
) -> WorkerProfile:
    result = await db.execute(
        select(WorkerProfile).where(
            WorkerProfile.id == worker_id
        )
    )

    worker = result.scalar_one_or_none()

    if not worker:
        raise HTTPException(
            status_code=404,
            detail="Worker profile not found",
        )

    return worker


async def validate_worker_for_job(
    db: AsyncSession,
    job: MaintenanceJob,
    worker: WorkerProfile,
):
    if not worker.is_active:
        raise HTTPException(
            status_code=400,
            detail="Worker is inactive",
        )

    skill_result = await db.execute(
        select(WorkerSkill).where(
            WorkerSkill.worker_id == worker.id,
            WorkerSkill.skill_code == job.required_skill,
            WorkerSkill.is_certified.is_(True),
        )
    )

    skills = skill_result.scalars().all()

    matching_skill = None

    for skill in skills:
        if (
            job.required_authority is None
            or skill.authority_code
            == job.required_authority
        ):
            matching_skill = skill
            break

    if matching_skill is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Worker does not have the required "
                "certified skill/authority"
            ),
        )

    availability = await get_latest_availability(
        db,
        worker.id,
    )

    if (
        availability is None
        or availability.status
        not in {
            WorkerAvailabilityStatus.AVAILABLE,
            WorkerAvailabilityStatus.PARTIAL,
        }
    ):
        raise HTTPException(
            status_code=400,
            detail="Worker is not currently available",
        )

    workload = await get_today_workload_minutes(
        db,
        worker.id,
    )

    max_minutes = int(
        worker.max_daily_minutes or 360
    )

    remaining = max(
        max_minutes - workload,
        0,
    )

    if remaining < int(
        job.estimated_minutes or 0
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Worker does not have enough "
                "remaining daily workload capacity"
            ),
        )

    return (
        matching_skill,
        availability,
        workload,
        remaining,
        max_minutes,
    )


# =========================================================
# CORRIDORS
# =========================================================


@router.get("/corridors")
async def get_corridors(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    result = await db.execute(
        select(RailwayCorridor).order_by(
            RailwayCorridor.name.asc()
        )
    )

    corridors = result.scalars().all()

    return {
        "count": len(corridors),
        "corridors": [
            {
                "id": corridor.id,
                "corridor_code": corridor.corridor_code,
                "name": corridor.name,
                "railway_zone": corridor.zone,
                "division": corridor.division,
                "source_type": "DEMO_REPLAY",
            }
            for corridor in corridors
        ],
    }


# =========================================================
# JOBS
# =========================================================


@router.get("/jobs")
async def get_jobs(
    corridor_id: int | None = None,
    severity: str | None = None,
    job_status: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    """
    Fast Manager list endpoint.

    Important:
    - one joined query instead of N+1 segment/corridor lookups
    - no per-row ML inference for all ~2000 jobs
    - includes completed/fixed worker information
    - ML still runs on single-job detail and worker suitability endpoints
    """

    query = (
        select(
            MaintenanceJob,
            TrackSegment,
            RailwayCorridor,
            ST_Y(MaintenanceJob.location).label("latitude"),
            ST_X(MaintenanceJob.location).label("longitude"),
        )
        .outerjoin(
            TrackSegment,
            TrackSegment.id == MaintenanceJob.track_segment_id,
        )
        .outerjoin(
            RailwayCorridor,
            RailwayCorridor.id == TrackSegment.corridor_id,
        )
    )

    if corridor_id is not None:
        query = query.where(
            RailwayCorridor.id == corridor_id
        )

    if severity:
        query = query.where(
            MaintenanceJob.severity == severity
        )

    if job_status:
        query = query.where(
            MaintenanceJob.status == job_status
        )

    query = query.order_by(
        MaintenanceJob.priority_score.desc().nullslast(),
        MaintenanceJob.id.asc(),
    )

    rows = (await db.execute(query)).all()

    # Load assignments once so completed work can be shown as FIXED BY worker.
    assignment_rows = (
        await db.execute(
            select(WorkerAssignment)
            .order_by(
                WorkerAssignment.maintenance_job_id.asc(),
                WorkerAssignment.id.desc(),
            )
        )
    ).scalars().all()

    latest_assignment_by_job = {}
    worker_ids = set()

    for assignment in assignment_rows:
        latest_assignment_by_job.setdefault(
            assignment.maintenance_job_id,
            assignment,
        )
        worker_ids.add(assignment.worker_id)

    worker_by_id = {}

    if worker_ids:
        workers = (
            await db.execute(
                select(WorkerProfile).where(
                    WorkerProfile.id.in_(worker_ids)
                )
            )
        ).scalars().all()

        worker_by_id = {
            worker.id: worker
            for worker in workers
        }

    response = []

    for job, segment, corridor, latitude, longitude in rows:
        assignment = latest_assignment_by_job.get(job.id)
        worker = (
            worker_by_id.get(assignment.worker_id)
            if assignment is not None
            else None
        )

        raw_status = job.status.value
        is_fixed = raw_status == JobStatus.COMPLETED.value

        response.append(
            {
                "id": job.id,
                "job_code": job.job_code,
                "title": job.title,
                "description": job.description,
                "asset_type": job.asset_type,
                "job_type": job.job_type,
                "severity": job.severity.value,
                "status": raw_status,
                "required_skill": job.required_skill,
                "required_authority": job.required_authority,
                "estimated_minutes": job.estimated_minutes,
                "priority_score": job.priority_score,
                "priority_reason": job.priority_reason,
                "predicted_failure_risk": job.predicted_failure_risk,
                "expected_train_impact": job.expected_train_impact,
                "estimated_delay_minutes": job.estimated_delay_minutes,
                "km_marker": job.km_marker,
                "planned_start": job.planned_start,
                "planned_end": job.planned_end,
                "actual_start": job.actual_start,
                "actual_end": job.actual_end,
                "latitude": float(latitude) if latitude is not None else None,
                "longitude": float(longitude) if longitude is not None else None,
                "is_fixed": is_fixed,
                "inspection_status": "COMPLETED" if is_fixed else "PENDING",
                "fixed_at": (
                    job.actual_end.isoformat()
                    if is_fixed and job.actual_end
                    else None
                ),
                "fixed_by_worker": (
                    {
                        "worker_id": worker.id,
                        "employee_code": worker.employee_code,
                        "designation": worker.designation,
                    }
                    if is_fixed and worker is not None
                    else None
                ),
                "assigned_worker": (
                    {
                        "worker_id": worker.id,
                        "employee_code": worker.employee_code,
                        "designation": worker.designation,
                        "assignment_status": assignment.status.value,
                        "progress_percent": assignment.progress_percent,
                    }
                    if worker is not None and assignment is not None
                    else None
                ),
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
                "corridor": (
                    {
                        "id": corridor.id,
                        "corridor_code": corridor.corridor_code,
                        "name": corridor.name,
                    }
                    if corridor
                    else None
                ),
                # List view intentionally uses the cached DB priority score.
                # Per-item ML inference remains available on /jobs/{job_id}.
                "priority_source": "DATABASE_PRIORITY_CACHE",
            }
        )

    return {
        "count": len(response),
        "jobs": response,
        "priority_engine": "FAST_LIST_CACHE",
        "ml_detail_endpoint": "/manager/jobs/{job_id}",
    }


@router.get("/jobs/{job_id}")
async def get_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    job = await get_job_or_404(
        db,
        job_id,
    )

    item = await job_to_dict(
        db,
        job,
    )

    try:
        ml_priority = predict_maintenance_priority(
            job
        )

        item["priority_score"] = ml_priority
        item["ml_priority_score"] = ml_priority
        item["priority_source"] = "ML_MODEL"

    except Exception as exc:
        item["ml_priority_score"] = None
        item["priority_source"] = "DATABASE_FALLBACK"
        item["ml_error"] = str(exc)

    return item


# =========================================================
# ELIGIBLE WORKERS
# =========================================================


@router.get("/jobs/{job_id}/eligible-workers")
async def eligible_workers(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    """
    Fast worker ranking:
    - batch DB reads
    - hard railway eligibility first
    - deterministic suitability for all feasible workers
    - ML inference only on the top 5 feasible candidates
    """

    job = await get_job_or_404(db, job_id)

    if job.status not in {
        JobStatus.PENDING,
        JobStatus.READY_FOR_ASSIGNMENT,
    }:
        return {
            "job_id": job.id,
            "job_code": job.job_code,
            "count": 0,
            "eligible_workers": [],
            "message": "Job is not currently available for worker assignment",
        }

    workers = (
        await db.execute(
            select(WorkerProfile).where(
                WorkerProfile.is_active.is_(True)
            )
        )
    ).scalars().all()

    if not workers:
        return {
            "job_id": job.id,
            "job_code": job.job_code,
            "count": 0,
            "eligible_workers": [],
        }

    worker_ids = [w.id for w in workers]

    # Batch matching certified skills.
    skills = (
        await db.execute(
            select(WorkerSkill).where(
                WorkerSkill.worker_id.in_(worker_ids),
                WorkerSkill.skill_code == job.required_skill,
                WorkerSkill.is_certified.is_(True),
            )
        )
    ).scalars().all()

    skill_by_worker = {}

    for skill in skills:
        if (
            job.required_authority is None
            or skill.authority_code == job.required_authority
        ):
            existing = skill_by_worker.get(skill.worker_id)

            if (
                existing is None
                or int(skill.proficiency_level or 0)
                > int(existing.proficiency_level or 0)
            ):
                skill_by_worker[skill.worker_id] = skill

    candidate_ids = list(skill_by_worker.keys())

    if not candidate_ids:
        return {
            "job_id": job.id,
            "job_code": job.job_code,
            "count": 0,
            "eligible_workers": [],
        }

    # Batch latest availability.
    availability_rows = (
        await db.execute(
            select(WorkerAvailability)
            .where(
                WorkerAvailability.worker_id.in_(candidate_ids)
            )
            .order_by(
                WorkerAvailability.worker_id.asc(),
                WorkerAvailability.updated_at.desc(),
                WorkerAvailability.id.desc(),
            )
        )
    ).scalars().all()

    latest_availability = {}

    for row in availability_rows:
        latest_availability.setdefault(row.worker_id, row)

    # Batch assignments and workload jobs.
    assignments = (
        await db.execute(
            select(WorkerAssignment).where(
                WorkerAssignment.worker_id.in_(candidate_ids),
                WorkerAssignment.status.notin_(
                    [AssignmentStatus.CANCELLED]
                ),
            )
        )
    ).scalars().all()

    workload_job_ids = list({
        a.maintenance_job_id
        for a in assignments
    })

    workload_jobs = []

    if workload_job_ids:
        workload_jobs = (
            await db.execute(
                select(MaintenanceJob).where(
                    MaintenanceJob.id.in_(workload_job_ids)
                )
            )
        ).scalars().all()

    workload_job_by_id = {
        item.id: item
        for item in workload_jobs
    }

    today = datetime.now(timezone.utc).date()
    workload_by_worker = {}

    for assignment in assignments:
        assigned_job = workload_job_by_id.get(
            assignment.maintenance_job_id
        )

        if (
            assigned_job is not None
            and assigned_job.planned_start is not None
            and assigned_job.planned_start.date() == today
        ):
            workload_by_worker[assignment.worker_id] = (
                workload_by_worker.get(assignment.worker_id, 0)
                + int(assigned_job.estimated_minutes or 0)
            )

    feasible = []

    for worker in workers:
        skill = skill_by_worker.get(worker.id)

        if skill is None:
            continue

        availability = latest_availability.get(worker.id)

        if (
            availability is None
            or availability.status not in {
                WorkerAvailabilityStatus.AVAILABLE,
                WorkerAvailabilityStatus.PARTIAL,
            }
        ):
            continue

        workload = int(
            workload_by_worker.get(worker.id, 0)
        )

        max_daily = int(worker.max_daily_minutes or 360)
        remaining = max(max_daily - workload, 0)

        if remaining < int(job.estimated_minutes or 0):
            continue

        proficiency = max(
            min(int(skill.proficiency_level or 1), 5),
            1,
        )

        availability_score = (
            100.0
            if availability.status
            == WorkerAvailabilityStatus.AVAILABLE
            else 70.0
        )

        workload_score = (
            remaining / max_daily * 100.0
            if max_daily > 0
            else 0.0
        )

        # Fast deterministic pre-ranking.
        pre_score = round(
            proficiency / 5 * 100.0 * 0.50
            + availability_score * 0.25
            + workload_score * 0.25,
            2,
        )

        feasible.append({
            "worker": worker,
            "skill": skill,
            "availability_obj": availability,
            "workload": workload,
            "remaining": remaining,
            "max_daily": max_daily,
            "proficiency": proficiency,
            "score": pre_score,
            "source": "RULE_PREFILTER",
        })

    feasible.sort(
        key=lambda item: item["score"],
        reverse=True,
    )

    # Only top 5 go through live ML inference. This keeps the modal responsive.
    for item in feasible[:5]:
        try:
            item["score"] = predict_worker_suitability(
                job=job,
                worker=item["worker"],
                availability=item["availability_obj"],
                proficiency_level=item["proficiency"],
                has_required_skill=True,
                same_zone=False,
            )
            item["source"] = "ML_MODEL"
        except Exception:
            item["source"] = "RULE_PREFILTER"

    feasible.sort(
        key=lambda item: item["score"],
        reverse=True,
    )

    eligible = []

    # Return top 25 instantly; enough for manager choice.
    for item in feasible[:25]:
        worker = item["worker"]
        skill = item["skill"]
        availability = item["availability_obj"]

        eligible.append({
            "worker_id": worker.id,
            "user_id": worker.user_id,
            "employee_code": worker.employee_code,
            "designation": worker.designation,
            "department": worker.department,
            "railway_zone": worker.railway_zone,
            "division": worker.division,
            "home_station_code": worker.home_station_code,
            "home_station_name": worker.home_station_name,
            "years_experience": worker.years_experience,
            "availability": availability.status.value,
            "skill_code": skill.skill_code,
            "skill_name": skill.skill_name,
            "authority_code": skill.authority_code,
            "proficiency_level": skill.proficiency_level,
            "daily_workload_minutes": item["workload"],
            "remaining_minutes": item["remaining"],
            "max_daily_minutes": item["max_daily"],
            "suitability_score": item["score"],
            "suitability_source": item["source"],
        })

    return {
        "job_id": job.id,
        "job_code": job.job_code,
        "required_skill": job.required_skill,
        "required_authority": job.required_authority,
        "estimated_minutes": job.estimated_minutes,
        "count": len(eligible),
        "eligible_workers": eligible,
        "ranking_mode": "BATCH_FILTER + ML_TOP_5",
    }


# =========================================================
# ASSIGN WORKER
# =========================================================


@router.post("/jobs/{job_id}/assign")
async def assign_worker(
    job_id: int,
    payload: AssignWorkerRequest,
    db: AsyncSession = Depends(get_db),
    manager_user: User = Depends(require_manager),
):
    job = await get_job_or_404(
        db,
        job_id,
    )

    if job.status not in {
        JobStatus.PENDING,
        JobStatus.READY_FOR_ASSIGNMENT,
    }:
        raise HTTPException(
            status_code=400,
            detail=(
                "Job is not available for assignment"
            ),
        )

    worker = await get_worker_or_404(
        db,
        payload.worker_id,
    )

    await validate_worker_for_job(
        db,
        job,
        worker,
    )

    duplicate_result = await db.execute(
        select(WorkerAssignment).where(
            WorkerAssignment.maintenance_job_id == job.id,
            WorkerAssignment.worker_id == worker.id,
            WorkerAssignment.status.notin_(
                [
                    AssignmentStatus.COMPLETED,
                    AssignmentStatus.CANCELLED,
                ]
            ),
        )
    )

    duplicate = duplicate_result.scalar_one_or_none()

    if duplicate:
        raise HTTPException(
            status_code=400,
            detail=(
                "This worker already has an active "
                "assignment for this job"
            ),
        )

    assignment = WorkerAssignment(
        maintenance_job_id=job.id,
        worker_id=worker.id,
        status=AssignmentStatus.ASSIGNED,
        progress_percent=0,
    )

    db.add(assignment)

    job.status = JobStatus.ASSIGNED

    await db.flush()

    db.add(
        WorkLog(
            maintenance_job_id=job.id,
            assignment_id=assignment.id,
            worker_id=worker.id,
            action="ASSIGNED",
            message=(
                f"Maintenance job assigned to "
                f"{worker.employee_code} by Manager."
            ),
            progress_percent=0,
        )
    )

    await db.commit()
    await db.refresh(assignment)

    await send_worker_event(
        db,
        worker.id,
        {
            "type": "JOB_ASSIGNED",
            "source_role": UserRole.MANAGER.value,
            "manager_user_id": manager_user.id,
            "worker_id": worker.id,
            "employee_code": worker.employee_code,
            "assignment_id": assignment.id,
            "job_id": job.id,
            "job_code": job.job_code,
            "job_title": job.title,
            "severity": job.severity.value,
            "job_status": job.status.value,
            "assignment_status": assignment.status.value,
            "timestamp": datetime.now(
                timezone.utc
            ).isoformat(),
        },
    )

    return {
        "message": "Worker assigned successfully",
        "assignment_id": assignment.id,
        "job_id": job.id,
        "job_code": job.job_code,
        "worker_id": worker.id,
        "employee_code": worker.employee_code,
        "assignment_status": assignment.status.value,
        "job_status": job.status.value,
        "realtime_event": "JOB_ASSIGNED",
    }


# =========================================================
# EXTENSION REQUESTS
# =========================================================


@router.get("/extension-requests")
async def get_extension_requests(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    result = await db.execute(
        select(ExtensionRequest)
        .order_by(
            ExtensionRequest.requested_at.desc()
        )
    )

    requests = result.scalars().all()

    response = []

    for request in requests:
        worker_result = await db.execute(
            select(WorkerProfile).where(
                WorkerProfile.id
                == request.worker_id
            )
        )

        worker = worker_result.scalar_one_or_none()

        job_result = await db.execute(
            select(MaintenanceJob).where(
                MaintenanceJob.id
                == request.maintenance_job_id
            )
        )

        job = job_result.scalar_one_or_none()

        response.append(
            {
                "id": request.id,
                "maintenance_job_id": request.maintenance_job_id,
                "assignment_id": request.assignment_id,
                "worker_id": request.worker_id,
                "employee_code": (
                    worker.employee_code
                    if worker
                    else None
                ),
                "job_code": (
                    job.job_code
                    if job
                    else None
                ),
                "job_title": (
                    job.title
                    if job
                    else None
                ),
                "requested_minutes": request.requested_minutes,
                "reason": request.reason,
                "status": request.status.value,
                "manager_note": request.manager_note,
                "created_at": request.requested_at,
                "decided_at": request.reviewed_at,
            }
        )

    return {
        "count": len(response),
        "extension_requests": response,
    }


# =========================================================
# APPROVE EXTENSION
# =========================================================


@router.post(
    "/extension-requests/{request_id}/approve"
)
async def approve_extension(
    request_id: int,
    payload: ExtensionDecisionRequest,
    db: AsyncSession = Depends(get_db),
    manager_user: User = Depends(require_manager),
):
    from app.models.operations import (
        AffectedTrain,
        AlternativeStatus,
        DisruptionEvent,
        DisruptionStatus,
        RouteAlternative,
    )

    result = await db.execute(
        select(ExtensionRequest).where(
            ExtensionRequest.id == request_id
        )
    )

    extension = result.scalar_one_or_none()

    if not extension:
        raise HTTPException(
            status_code=404,
            detail="Extension request not found",
        )

    if extension.status != ExtensionStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=(
                "Extension request has already "
                "been processed"
            ),
        )

    job = await get_job_or_404(
        db,
        extension.maintenance_job_id,
    )

    assignment_result = await db.execute(
        select(WorkerAssignment).where(
            WorkerAssignment.id
            == extension.assignment_id
        )
    )

    assignment = assignment_result.scalar_one_or_none()

    extension.status = ExtensionStatus.APPROVED
    extension.manager_note = payload.manager_note
    extension.reviewed_at = datetime.now(timezone.utc)
    extension.reviewed_by_user_id = manager_user.id

    previous_planned_end = job.planned_end

    if job.planned_end is not None:
        job.planned_end = (
            job.planned_end
            + timedelta(
                minutes=extension.requested_minutes
            )
        )

    extension.approved_new_end = job.planned_end

    if assignment:
        if assignment.status == AssignmentStatus.PAUSED:
            job.status = JobStatus.PAUSED
        else:
            job.status = JobStatus.IN_PROGRESS

    db.add(
        WorkLog(
            maintenance_job_id=job.id,
            assignment_id=extension.assignment_id,
            worker_id=extension.worker_id,
            action="EXTENSION_APPROVED",
            message=(
                f"Manager approved "
                f"{extension.requested_minutes} "
                f"additional minutes."
            ),
            progress_percent=(
                assignment.progress_percent
                if assignment
                else None
            ),
        )
    )

    disruption_result = await db.execute(
        select(DisruptionEvent).where(
            DisruptionEvent.maintenance_job_id == job.id,
            DisruptionEvent.status != DisruptionStatus.RESOLVED,
        )
    )

    disruption = disruption_result.scalars().first()

    base_delay = float(
        job.estimated_delay_minutes or 0.0
    )

    extension_delay = max(
        float(extension.requested_minutes) * 0.55,
        5.0,
    )

    predicted_delay = round(
        max(
            base_delay,
            extension_delay,
        ),
        1,
    )

    if disruption is None:
        disruption_code = (
            f"EXT-{job.job_code}-{extension.id}"
        )[:80]

        disruption = DisruptionEvent(
            disruption_code=disruption_code,
            maintenance_job_id=job.id,
            track_segment_id=job.track_segment_id,
            status=DisruptionStatus.EVALUATING,
            reason=(
                f"Approved maintenance extension of "
                f"{extension.requested_minutes} minutes "
                f"for {job.job_code}. Train Control "
                f"impact review required."
            ),
            expected_start=(
                job.planned_start
                or datetime.now(timezone.utc)
            ),
            expected_end=job.planned_end,
            estimated_delay_minutes=predicted_delay,
            severity=job.severity,
        )

        db.add(disruption)
        await db.flush()

    else:
        disruption.status = DisruptionStatus.EVALUATING
        disruption.reason = (
            f"Maintenance extension approved: "
            f"+{extension.requested_minutes} minutes "
            f"for {job.job_code}. Re-evaluate train impact."
        )
        disruption.expected_end = job.planned_end
        disruption.estimated_delay_minutes = max(
            float(disruption.estimated_delay_minutes or 0.0),
            predicted_delay,
        )
        disruption.severity = job.severity

        await db.flush()

    affected_result = await db.execute(
        select(AffectedTrain).where(
            AffectedTrain.disruption_id == disruption.id
        )
    )

    existing_affected = affected_result.scalars().all()

    if not existing_affected:
        replay_train_templates = [
            (
                f"{12600 + (job.id % 80):05d}",
                "RailSync Express DEMO_REPLAY",
                "EXPRESS",
                1.00,
            ),
            (
                f"{66000 + (job.id % 90):05d}",
                "RailSync Local DEMO_REPLAY",
                "LOCAL",
                0.72,
            ),
            (
                f"{12000 + (job.id % 70):05d}",
                "RailSync Superfast DEMO_REPLAY",
                "SUPERFAST",
                1.18,
            ),
        ]

        passage_base = (
            previous_planned_end
            or job.planned_start
            or datetime.now(timezone.utc)
        )

        for index, (
            train_number,
            train_name,
            priority_class,
            delay_factor,
        ) in enumerate(replay_train_templates):
            db.add(
                AffectedTrain(
                    disruption_id=disruption.id,
                    train_id=None,
                    train_number=train_number,
                    train_name=train_name,
                    scheduled_passage=(
                        passage_base
                        + timedelta(
                            minutes=15 * (index + 1)
                        )
                    ),
                    predicted_delay_minutes=round(
                        predicted_delay * delay_factor,
                        1,
                    ),
                    priority_class=priority_class,
                )
            )

    alternatives_result = await db.execute(
        select(RouteAlternative).where(
            RouteAlternative.disruption_id
            == disruption.id
        )
    )

    existing_alternatives = alternatives_result.scalars().all()

    if not existing_alternatives:
        hold_delay = round(
            predicted_delay + 8.0,
            1,
        )

        regulate_delay = round(
            max(
                predicted_delay * 0.72,
                3.0,
            ),
            1,
        )

        reroute_delay = round(
            max(
                predicted_delay * 0.55,
                2.0,
            ),
            1,
        )

        alternatives = [
            RouteAlternative(
                disruption_id=disruption.id,
                alternative_code=(
                    f"{disruption.disruption_code}-A1"
                )[:80],
                action_type="REROUTE",
                title="Use Feasible Alternate Corridor",
                description=(
                    "Divert affected service through a "
                    "pre-generated feasible alternate corridor "
                    "when route capacity permits."
                ),
                predicted_delay_minutes=reroute_delay,
                predicted_cost=72.0,
                conflict_count=1,
                feasibility_score=0.91,
                ml_rank_score=0.93,
                is_feasible=True,
                status=AlternativeStatus.RECOMMENDED,
                generated_reason=(
                    "DEMO_REPLAY ranking. Feasible route/action "
                    "candidate with lower predicted delay. "
                    "Replace ranking score with trained model "
                    "output when ML inference is wired."
                ),
            ),
            RouteAlternative(
                disruption_id=disruption.id,
                alternative_code=(
                    f"{disruption.disruption_code}-A2"
                )[:80],
                action_type="SPEED_REGULATION",
                title="Regulate Approach and Sequence Trains",
                description=(
                    "Meter approaching trains and sequence "
                    "higher-priority services through the "
                    "available path."
                ),
                predicted_delay_minutes=regulate_delay,
                predicted_cost=48.0,
                conflict_count=2,
                feasibility_score=0.86,
                ml_rank_score=0.84,
                is_feasible=True,
                status=AlternativeStatus.GENERATED,
                generated_reason=(
                    "DEMO_REPLAY heuristic ranking based on "
                    "delay, conflicts and feasibility."
                ),
            ),
            RouteAlternative(
                disruption_id=disruption.id,
                alternative_code=(
                    f"{disruption.disruption_code}-A3"
                )[:80],
                action_type="HOLD",
                title="Controlled Hold Before Maintenance Block",
                description=(
                    "Hold the affected train before the "
                    "maintenance section until a safe movement "
                    "window becomes available."
                ),
                predicted_delay_minutes=hold_delay,
                predicted_cost=31.0,
                conflict_count=0,
                feasibility_score=0.97,
                ml_rank_score=0.68,
                is_feasible=True,
                status=AlternativeStatus.GENERATED,
                generated_reason=(
                    "DEMO_REPLAY heuristic ranking. Lowest "
                    "conflict risk but higher delay."
                ),
            ),
        ]

        for alternative in alternatives:
            db.add(alternative)

    await db.commit()

    await send_worker_event(
        db,
        extension.worker_id,
        {
            "type": "EXTENSION_APPROVED",
            "source_role": UserRole.MANAGER.value,
            "manager_user_id": manager_user.id,
            "extension_request_id": extension.id,
            "assignment_id": extension.assignment_id,
            "job_id": job.id,
            "job_code": job.job_code,
            "requested_minutes": extension.requested_minutes,
            "manager_note": extension.manager_note,
            "new_planned_end": (
                job.planned_end.isoformat()
                if job.planned_end
                else None
            ),
            "timestamp": datetime.now(
                timezone.utc
            ).isoformat(),
        },
    )

    await realtime_manager.send_to_role(
        UserRole.TRAIN_OPERATOR.value,
        {
            "type": "MAINTENANCE_EXTENSION_APPROVED",
            "source_role": UserRole.MANAGER.value,
            "manager_user_id": manager_user.id,
            "extension_request_id": extension.id,
            "disruption_id": disruption.id,
            "disruption_code": disruption.disruption_code,
            "job_id": job.id,
            "job_code": job.job_code,
            "requested_minutes": extension.requested_minutes,
            "predicted_delay_minutes": (
                disruption.estimated_delay_minutes
            ),
            "new_planned_end": (
                job.planned_end.isoformat()
                if job.planned_end
                else None
            ),
            "message": (
                "Maintenance duration changed. "
                "Train Control disruption review created."
            ),
            "timestamp": datetime.now(
                timezone.utc
            ).isoformat(),
        },
    )

    return {
        "message": "Extension approved",
        "extension_request_id": extension.id,
        "status": extension.status.value,
        "requested_minutes": extension.requested_minutes,
        "new_planned_end": job.planned_end,
        "worker_event": "EXTENSION_APPROVED",
        "operator_event": (
            "MAINTENANCE_EXTENSION_APPROVED"
        ),
        "operator_disruption": {
            "id": disruption.id,
            "disruption_code": disruption.disruption_code,
            "status": disruption.status.value,
            "predicted_delay_minutes": (
                disruption.estimated_delay_minutes
            ),
            "data_mode": "DEMO_REPLAY",
        },
    }


# =========================================================
# REJECT EXTENSION
# =========================================================


@router.post(
    "/extension-requests/{request_id}/reject"
)
async def reject_extension(
    request_id: int,
    payload: ExtensionDecisionRequest,
    db: AsyncSession = Depends(get_db),
    manager_user: User = Depends(require_manager),
):
    result = await db.execute(
        select(ExtensionRequest).where(
            ExtensionRequest.id == request_id
        )
    )

    extension = result.scalar_one_or_none()

    if not extension:
        raise HTTPException(
            status_code=404,
            detail="Extension request not found",
        )

    if extension.status != ExtensionStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=(
                "Extension request has already "
                "been processed"
            ),
        )

    job = await get_job_or_404(
        db,
        extension.maintenance_job_id,
    )

    assignment_result = await db.execute(
        select(WorkerAssignment).where(
            WorkerAssignment.id
            == extension.assignment_id
        )
    )

    assignment = assignment_result.scalar_one_or_none()

    extension.status = ExtensionStatus.REJECTED
    extension.manager_note = payload.manager_note
    extension.reviewed_at = datetime.now(timezone.utc)
    extension.reviewed_by_user_id = manager_user.id

    if assignment:
        if assignment.status == AssignmentStatus.PAUSED:
            job.status = JobStatus.PAUSED
        elif assignment.status == AssignmentStatus.IN_PROGRESS:
            job.status = JobStatus.IN_PROGRESS

    db.add(
        WorkLog(
            maintenance_job_id=job.id,
            assignment_id=extension.assignment_id,
            worker_id=extension.worker_id,
            action="EXTENSION_REJECTED",
            message=(
                "Manager rejected the maintenance "
                "extension request."
            ),
            progress_percent=(
                assignment.progress_percent
                if assignment
                else None
            ),
        )
    )

    await db.commit()

    await send_worker_event(
        db,
        extension.worker_id,
        {
            "type": "EXTENSION_REJECTED",
            "source_role": UserRole.MANAGER.value,
            "manager_user_id": manager_user.id,
            "extension_request_id": extension.id,
            "assignment_id": extension.assignment_id,
            "job_id": job.id,
            "job_code": job.job_code,
            "requested_minutes": extension.requested_minutes,
            "manager_note": extension.manager_note,
            "timestamp": datetime.now(
                timezone.utc
            ).isoformat(),
        },
    )

    return {
        "message": "Extension rejected",
        "extension_request_id": extension.id,
        "status": extension.status.value,
        "worker_event": "EXTENSION_REJECTED",
    }


# =========================================================
# WORKFORCE AVAILABILITY SUMMARY
# =========================================================


@router.get("/workforce-summary")
async def workforce_summary(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    workers = (
        await db.execute(
            select(WorkerProfile)
            .where(WorkerProfile.is_active.is_(True))
            .order_by(WorkerProfile.employee_code.asc())
        )
    ).scalars().all()

    availability_rows = (
        await db.execute(
            select(WorkerAvailability)
            .order_by(
                WorkerAvailability.worker_id.asc(),
                WorkerAvailability.updated_at.desc(),
                WorkerAvailability.id.desc(),
            )
        )
    ).scalars().all()

    latest = {}

    for record in availability_rows:
        latest.setdefault(
            record.worker_id,
            record,
        )

    counts = {
        "AVAILABLE": 0,
        "PARTIAL": 0,
        "UNAVAILABLE": 0,
    }

    items = []

    for worker in workers:
        availability = latest.get(worker.id)

        availability_status = (
            availability.status.value
            if availability is not None
            else WorkerAvailabilityStatus.UNAVAILABLE.value
        )

        if availability_status not in counts:
            availability_status = "UNAVAILABLE"

        counts[availability_status] += 1

        items.append(
            {
                "worker_id": worker.id,
                "employee_code": worker.employee_code,
                "designation": worker.designation,
                "department": worker.department,
                "railway_zone": worker.railway_zone,
                "division": worker.division,
                "home_station_code": worker.home_station_code,
                "home_station_name": worker.home_station_name,
                "availability": availability_status,
                "available_from": (
                    availability.available_from
                    if availability is not None
                    else None
                ),
                "available_until": (
                    availability.available_until
                    if availability is not None
                    else None
                ),
            }
        )

    return {
        "total": len(workers),
        "available": counts["AVAILABLE"],
        "partial": counts["PARTIAL"],
        "unavailable": counts["UNAVAILABLE"],
        "workers": items,
    }


# =========================================================
# ML STATUS
# =========================================================

@router.get("/ml/status")
async def get_ml_status(
    _: User = Depends(require_manager),
):
    return model_status()
