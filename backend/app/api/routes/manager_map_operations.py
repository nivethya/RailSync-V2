from __future__ import annotations

from collections import defaultdict
from typing import Any

from fastapi import APIRouter, Depends
from geoalchemy2.functions import ST_X, ST_Y
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.manager_operations import require_manager
from app.core.database import get_db
from app.models.operations import (
    MaintenanceJob,
    RailwayCorridor,
    TrackSegment,
    WorkerAssignment,
    WorkerAvailability,
    WorkerProfile,
)
from app.models.user import User


router = APIRouter(
    prefix="/api/v1/manager",
    tags=["manager-map"],
)


def _enum(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(getattr(value, "value", value))


@router.get("/map-overview")
async def manager_map_overview(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    """
    Complete Manager geographic overview.

    Important:
    - returns ALL maintenance jobs/fault-linked work, not only CRITICAL items
    - COMPLETED work is exposed as FIXED
    - completed assignment worker is exposed as fixed_by_worker
    - current worker AVAILABLE/PARTIAL/UNAVAILABLE status is summarized
    """

    corridor_result = await db.execute(
        select(RailwayCorridor)
    )
    corridors = corridor_result.scalars().all()
    corridor_by_id = {
        item.id: item
        for item in corridors
    }

    segment_result = await db.execute(
        select(TrackSegment)
    )
    segments = segment_result.scalars().all()
    segment_by_id = {
        item.id: item
        for item in segments
    }

    # Fetch job coordinates directly from PostGIS.
    job_result = await db.execute(
        select(
            MaintenanceJob,
            ST_Y(MaintenanceJob.location).label("lat"),
            ST_X(MaintenanceJob.location).label("lon"),
        )
        .order_by(
            MaintenanceJob.priority_score.desc().nullslast(),
            MaintenanceJob.id.asc(),
        )
    )
    job_rows = job_result.all()

    assignment_result = await db.execute(
        select(WorkerAssignment)
        .order_by(
            WorkerAssignment.maintenance_job_id.asc(),
            WorkerAssignment.id.desc(),
        )
    )
    assignments = assignment_result.scalars().all()

    assignment_by_job: dict[int, WorkerAssignment] = {}
    for assignment in assignments:
        assignment_by_job.setdefault(
            assignment.maintenance_job_id,
            assignment,
        )

    worker_result = await db.execute(
        select(WorkerProfile)
        .where(WorkerProfile.is_active.is_(True))
        .order_by(WorkerProfile.employee_code.asc())
    )
    workers = worker_result.scalars().all()
    worker_by_id = {
        worker.id: worker
        for worker in workers
    }

    availability_result = await db.execute(
        select(WorkerAvailability)
        .order_by(
            WorkerAvailability.worker_id.asc(),
            WorkerAvailability.updated_at.desc(),
            WorkerAvailability.id.desc(),
        )
    )
    availability_records = availability_result.scalars().all()

    latest_availability: dict[int, WorkerAvailability] = {}
    for record in availability_records:
        latest_availability.setdefault(
            record.worker_id,
            record,
        )

    workforce_counts = defaultdict(int)
    worker_payload = []

    for worker in workers:
        availability = latest_availability.get(worker.id)
        status = _enum(
            getattr(availability, "status", None),
            "UNAVAILABLE",
        ).upper()

        if status not in {
            "AVAILABLE",
            "PARTIAL",
            "UNAVAILABLE",
        }:
            status = "UNAVAILABLE"

        workforce_counts[status] += 1

        worker_payload.append({
            "worker_id": worker.id,
            "employee_code": worker.employee_code,
            "designation": worker.designation,
            "department": worker.department,
            "railway_zone": worker.railway_zone,
            "division": worker.division,
            "home_station_code": worker.home_station_code,
            "home_station_name": worker.home_station_name,
            "availability": status,
            "available_from": (
                availability.available_from.isoformat()
                if availability
                and availability.available_from
                else None
            ),
            "available_until": (
                availability.available_until.isoformat()
                if availability
                and availability.available_until
                else None
            ),
            "availability_reason": (
                availability.reason
                if availability
                else None
            ),
        })

    map_jobs = []
    active_count = 0
    fixed_count = 0

    for job, lat, lon in job_rows:
        segment = segment_by_id.get(
            job.track_segment_id
        )
        corridor = (
            corridor_by_id.get(segment.corridor_id)
            if segment is not None
            else None
        )

        assignment = assignment_by_job.get(
            job.id
        )
        assigned_worker = (
            worker_by_id.get(assignment.worker_id)
            if assignment is not None
            else None
        )

        raw_status = _enum(
            job.status,
            "PENDING",
        ).upper()

        fixed = raw_status == "COMPLETED"

        if fixed:
            fixed_count += 1
        elif raw_status != "CANCELLED":
            active_count += 1

        map_jobs.append({
            "id": job.id,
            "job_code": job.job_code,
            "title": job.title,
            "description": job.description,
            "asset_type": job.asset_type,
            "job_type": job.job_type,
            "severity": _enum(job.severity, "MEDIUM").upper(),
            "status": (
                "FIXED"
                if fixed
                else raw_status
            ),
            "maintenance_status": raw_status,
            "inspection_status": (
                "COMPLETED"
                if fixed
                else "PENDING"
            ),
            "is_fixed": fixed,
            "fixed_at": (
                assignment.completed_at.isoformat()
                if assignment
                and assignment.completed_at
                else (
                    job.actual_end.isoformat()
                    if job.actual_end
                    else None
                )
            ),
            "fixed_by_worker": (
                {
                    "worker_id": assigned_worker.id,
                    "employee_code": assigned_worker.employee_code,
                    "designation": assigned_worker.designation,
                }
                if fixed
                and assigned_worker is not None
                else None
            ),
            "assigned_worker": (
                {
                    "worker_id": assigned_worker.id,
                    "employee_code": assigned_worker.employee_code,
                    "designation": assigned_worker.designation,
                    "assignment_status": _enum(
                        assignment.status
                        if assignment
                        else None,
                    ),
                    "progress_percent": (
                        assignment.progress_percent
                        if assignment
                        else 0
                    ),
                }
                if assigned_worker is not None
                else None
            ),
            "latitude": float(lat) if lat is not None else None,
            "longitude": float(lon) if lon is not None else None,
            "km_marker": job.km_marker,
            "priority_score": job.priority_score,
            "estimated_delay_minutes": job.estimated_delay_minutes,
            "expected_train_impact": job.expected_train_impact,
            "corridor": (
                {
                    "id": corridor.id,
                    "name": corridor.name,
                    "corridor_code": corridor.corridor_code,
                    "zone": corridor.zone,
                    "division": corridor.division,
                }
                if corridor
                else None
            ),
            "segment": (
                {
                    "id": segment.id,
                    "name": segment.name,
                    "segment_code": segment.segment_code,
                    "from_station_name": segment.from_station_name,
                    "to_station_name": segment.to_station_name,
                    "track_number": segment.track_number,
                    "direction": segment.direction,
                }
                if segment
                else None
            ),
        })

    return {
        "data_mode": "DEMO_REPLAY",
        "faults": {
            "total": len(map_jobs),
            "active": active_count,
            "fixed": fixed_count,
            "items": map_jobs,
        },
        "workforce": {
            "total": len(workers),
            "available": workforce_counts["AVAILABLE"],
            "partial": workforce_counts["PARTIAL"],
            "unavailable": workforce_counts["UNAVAILABLE"],
            "workers": worker_payload,
        },
    }
