from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.operations import (
    MaintenanceJob,
    RailwayCorridor,
    TrackSegment,
)
from app.services.ml_service import predict_maintenance_priority


ACTIVE_JOB_STATUSES = {
    "PENDING",
    "READY_FOR_ASSIGNMENT",
    "ASSIGNED",
    "IN_PROGRESS",
    "PAUSED",
    "EXTENSION_REQUESTED",
}


def _enum_value(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(getattr(value, "value", value))


def _num(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return float(default)
        return float(value)
    except Exception:
        return float(default)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class PlannerConfig:
    horizon_hours: int = 24
    slot_minutes: int = 30
    max_candidates_per_group: int = 4
    clubbing_window_minutes: int = 120


class AutomaticBlockPlanner:
    """
    RailSync Automatic Block Planning Engine.

    Rules:
    - Only maintenance jobs explicitly marked block_required are considered.
    - Jobs are grouped by corridor/segment proximity.
    - Compatible jobs are clubbed to reduce repeated track possessions.
    - Candidate windows are scored by maintenance urgency, train-impact proxy,
      duration and conflict proxy.
    - ML is used only for maintenance-priority estimation.
    - This service does NOT invent train routes.
    """

    def __init__(
        self,
        db: AsyncSession,
        config: PlannerConfig | None = None,
    ):
        self.db = db
        self.config = config or PlannerConfig()

    async def _load_data(self):
        jobs_result = await self.db.execute(
            select(MaintenanceJob)
            .where(MaintenanceJob.block_required.is_(True))
            .order_by(MaintenanceJob.id.asc())
        )
        all_jobs = jobs_result.scalars().all()

        jobs = [
            job
            for job in all_jobs
            if _enum_value(job.status) in ACTIVE_JOB_STATUSES
        ]

        segment_result = await self.db.execute(
            select(TrackSegment)
        )
        segments = segment_result.scalars().all()

        corridor_result = await self.db.execute(
            select(RailwayCorridor)
        )
        corridors = corridor_result.scalars().all()

        segment_by_id = {
            segment.id: segment
            for segment in segments
        }

        corridor_by_id = {
            corridor.id: corridor
            for corridor in corridors
        }

        return jobs, segment_by_id, corridor_by_id

    def _priority(self, job: MaintenanceJob) -> float:
        try:
            return float(
                predict_maintenance_priority(job)
            )
        except Exception:
            return _num(
                getattr(job, "priority_score", None),
                50,
            )

    def _job_payload(
        self,
        job: MaintenanceJob,
    ) -> dict[str, Any]:
        return {
            "id": job.id,
            "job_code": job.job_code,
            "title": job.title,
            "severity": _enum_value(job.severity),
            "status": _enum_value(job.status),
            "estimated_minutes": int(
                _num(job.estimated_minutes, 60)
            ),
            "estimated_delay_minutes": round(
                _num(job.estimated_delay_minutes),
                2,
            ),
            "expected_train_impact": round(
                _num(job.expected_train_impact),
                2,
            ),
            "priority_score": round(
                self._priority(job),
                2,
            ),
            "track_segment_id": job.track_segment_id,
            "km_marker": _num(job.km_marker),
            "asset_type": job.asset_type,
            "job_type": job.job_type,
        }

    def _group_key(
        self,
        job: MaintenanceJob,
        segment_by_id: dict[int, TrackSegment],
    ):
        segment = segment_by_id.get(
            job.track_segment_id
        )

        if segment is None:
            return (
                "UNKNOWN",
                job.track_segment_id or 0,
            )

        return (
            segment.corridor_id,
            segment.id,
        )

    def _group_jobs(
        self,
        jobs: list[MaintenanceJob],
        segment_by_id: dict[int, TrackSegment],
    ):
        grouped: dict[
            tuple[Any, Any],
            list[MaintenanceJob],
        ] = defaultdict(list)

        for job in jobs:
            grouped[
                self._group_key(
                    job,
                    segment_by_id,
                )
            ].append(job)

        return grouped

    def _candidate_start_times(
        self,
        now: datetime,
    ) -> list[datetime]:
        starts: list[datetime] = []

        slot = self.config.slot_minutes

        minute = (
            (now.minute // slot) + 1
        ) * slot

        base = now.replace(
            second=0,
            microsecond=0,
        )

        if minute >= 60:
            base = (
                base.replace(minute=0)
                + timedelta(hours=1)
            )
        else:
            base = base.replace(
                minute=minute
            )

        for hour_offset in range(
            self.config.horizon_hours
        ):
            starts.append(
                base
                + timedelta(
                    hours=hour_offset
                )
            )

        return starts

    def _traffic_factor(
        self,
        start: datetime,
    ) -> float:
        hour = start.hour

        # Higher means worse for possession.
        if 7 <= hour <= 10:
            return 1.0

        if 17 <= hour <= 21:
            return 1.0

        if 0 <= hour <= 4:
            return 0.22

        if 11 <= hour <= 16:
            return 0.65

        return 0.45

    def _candidate_score(
        self,
        jobs: list[MaintenanceJob],
        start: datetime,
        duration_minutes: int,
    ) -> dict[str, float]:
        priorities = [
            self._priority(job)
            for job in jobs
        ]

        urgency = (
            sum(priorities)
            / max(len(priorities), 1)
        )

        train_impact = (
            sum(
                _num(
                    job.expected_train_impact
                )
                for job in jobs
            )
            / max(len(jobs), 1)
        )

        delay_proxy = sum(
            _num(
                job.estimated_delay_minutes
            )
            for job in jobs
        )

        traffic = self._traffic_factor(
            start
        )

        clubbing_bonus = min(
            15.0,
            max(
                0,
                len(jobs) - 1,
            )
            * 5.0,
        )

        duration_penalty = min(
            22.0,
            duration_minutes / 30.0 * 2.0,
        )

        conflict_proxy = (
            traffic * 55
            + train_impact * 0.8
            + delay_proxy * 0.35
        )

        score = (
            urgency * 0.62
            + clubbing_bonus
            - conflict_proxy * 0.30
            - duration_penalty * 0.08
        )

        score = max(
            0.0,
            min(
                100.0,
                score,
            ),
        )

        return {
            "score": round(score, 2),
            "urgency_score": round(
                urgency,
                2,
            ),
            "traffic_conflict_score": round(
                min(100.0, conflict_proxy),
                2,
            ),
            "clubbing_bonus": round(
                clubbing_bonus,
                2,
            ),
        }

    async def generate(
        self,
        *,
        corridor_id: int | None = None,
        track_segment_id: int | None = None,
    ) -> dict[str, Any]:
        (
            jobs,
            segment_by_id,
            corridor_by_id,
        ) = await self._load_data()

        if track_segment_id is not None:
            jobs = [
                job
                for job in jobs
                if job.track_segment_id
                == track_segment_id
            ]

        if corridor_id is not None:
            jobs = [
                job
                for job in jobs
                if (
                    segment_by_id.get(
                        job.track_segment_id
                    )
                    is not None
                    and segment_by_id[
                        job.track_segment_id
                    ].corridor_id
                    == corridor_id
                )
            ]

        grouped = self._group_jobs(
            jobs,
            segment_by_id,
        )

        now = _utcnow()

        candidate_starts = (
            self._candidate_start_times(
                now
            )
        )

        plans: list[dict[str, Any]] = []

        plan_counter = 1

        for (
            corridor_key,
            segment_id,
        ), group_jobs in grouped.items():
            segment = segment_by_id.get(
                segment_id
            )

            corridor = corridor_by_id.get(
                corridor_key
            )

            ordered_jobs = sorted(
                group_jobs,
                key=lambda job: (
                    self._priority(job),
                    -_num(
                        job.estimated_minutes,
                        60,
                    ),
                ),
                reverse=True,
            )

            # Club all compatible jobs on the same segment,
            # but cap the total duration for a practical demo block.
            selected_jobs: list[
                MaintenanceJob
            ] = []

            total_minutes = 0

            for job in ordered_jobs:
                job_minutes = int(
                    _num(
                        job.estimated_minutes,
                        60,
                    )
                )

                proposed_total = (
                    total_minutes
                    + job_minutes
                )

                if (
                    selected_jobs
                    and proposed_total
                    > self.config.clubbing_window_minutes
                ):
                    continue

                selected_jobs.append(
                    job
                )
                total_minutes = (
                    proposed_total
                )

            if not selected_jobs:
                continue

            # Add fixed operational setup/clearance margin.
            block_minutes = max(
                30,
                total_minutes + 15,
            )

            candidates = []

            for start in candidate_starts:
                metrics = (
                    self._candidate_score(
                        selected_jobs,
                        start,
                        block_minutes,
                    )
                )

                candidates.append({
                    "candidate_id": (
                        f"BLK-CAND-"
                        f"{plan_counter:04d}-"
                        f"{start.strftime('%H%M')}"
                    ),
                    "start": start.isoformat(),
                    "end": (
                        start
                        + timedelta(
                            minutes=block_minutes
                        )
                    ).isoformat(),
                    "duration_minutes": block_minutes,
                    **metrics,
                })

            candidates.sort(
                key=lambda item: (
                    item["score"],
                    -item[
                        "traffic_conflict_score"
                    ],
                ),
                reverse=True,
            )

            candidates = candidates[
                :
                self.config.max_candidates_per_group
            ]

            recommended = (
                candidates[0]
                if candidates
                else None
            )

            plans.append({
                "plan_id": (
                    f"AUTO-BLOCK-"
                    f"{plan_counter:04d}"
                ),
                "corridor_id": (
                    corridor.id
                    if corridor
                    else None
                ),
                "corridor_code": (
                    corridor.corridor_code
                    if corridor
                    else None
                ),
                "corridor_name": (
                    corridor.name
                    if corridor
                    else "Unknown corridor"
                ),
                "zone": (
                    corridor.zone
                    if corridor
                    else None
                ),
                "division": (
                    corridor.division
                    if corridor
                    else None
                ),
                "track_segment_id": (
                    segment.id
                    if segment
                    else segment_id
                ),
                "segment_code": (
                    segment.segment_code
                    if segment
                    else None
                ),
                "segment_name": (
                    segment.name
                    if segment
                    else "Unknown segment"
                ),
                "from_station": (
                    segment.from_station_name
                    if segment
                    else None
                ),
                "to_station": (
                    segment.to_station_name
                    if segment
                    else None
                ),
                "jobs": [
                    self._job_payload(
                        job
                    )
                    for job in selected_jobs
                ],
                "job_count": len(
                    selected_jobs
                ),
                "clubbing_applied": (
                    len(selected_jobs)
                    > 1
                ),
                "recommended_candidate": (
                    recommended
                ),
                "alternatives": candidates[
                    1:
                ],
                "decision_basis": [
                    "ML maintenance-priority score",
                    "same-segment maintenance clubbing",
                    "estimated train-impact proxy",
                    "peak/off-peak conflict rule",
                    "block duration and clearance margin",
                ],
            })

            plan_counter += 1

        plans.sort(
            key=lambda item: (
                (
                    item[
                        "recommended_candidate"
                    ]
                    or {}
                ).get(
                    "score",
                    0,
                )
            ),
            reverse=True,
        )

        return {
            "generated_at": now.isoformat(),
            "data_mode": "DEMO_REPLAY",
            "engine": (
                "RAILSYNC_AUTOMATIC_BLOCK_PLANNER_V1"
            ),
            "horizon_hours": (
                self.config.horizon_hours
            ),
            "total_block_required_jobs": len(
                jobs
            ),
            "plan_count": len(plans),
            "plans": plans,
            "notes": [
                (
                    "The planner creates feasible maintenance "
                    "possession candidates from existing jobs."
                ),
                (
                    "It does not invent train routes. "
                    "Route feasibility remains under operator/rule control."
                ),
                (
                    "Human manager approval remains mandatory."
                ),
            ],
        }
