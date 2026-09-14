from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.services.ml_service import (
    model_status,
    predict_train_delay,
)

from app.models.user import User, UserRole
from app.models.operations import (
    AffectedTrain,
    AlternativeStatus,
    DisruptionEvent,
    DisruptionStatus,
    MaintenanceJob,
    RailwayCorridor,
    RouteAlternative,
    TrackSegment,
)


router = APIRouter()


def require_operator(user: User) -> None:
    if user.role != UserRole.TRAIN_OPERATOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Train Operator access required",
        )


class SelectAlternativeRequest(BaseModel):
    note: str | None = None


def is_national_operator(user: User) -> bool:
    return (
        str(user.zone or "").upper() in {"ALL", "INDIA", "NATIONAL"}
        or str(user.division or "").upper() in {"ALL", "INDIA", "NATIONAL"}
    )


def operator_scope_label(user: User) -> str:
    if is_national_operator(user):
        return "PAN-INDIA"
    zone = str(user.zone or "UNASSIGNED")
    division = str(user.division or "ALL")
    return f"{zone} / {division}"


def apply_operator_scope(query, user: User):
    if is_national_operator(user):
        return query

    query = (
        query
        .join(
            TrackSegment,
            TrackSegment.id == DisruptionEvent.track_segment_id,
        )
        .join(
            RailwayCorridor,
            RailwayCorridor.id == TrackSegment.corridor_id,
        )
    )

    if user.zone:
        query = query.where(RailwayCorridor.zone == user.zone)

    if user.division and str(user.division).upper() not in {"ALL", "INDIA", "NATIONAL"}:
        query = query.where(RailwayCorridor.division == user.division)

    return query


async def require_disruption_in_operator_scope(
    db: AsyncSession,
    disruption_id: int,
    current_user: User,
) -> DisruptionEvent:
    query = select(DisruptionEvent).where(DisruptionEvent.id == disruption_id)
    query = apply_operator_scope(query, current_user)
    result = await db.execute(query)
    disruption = result.scalar_one_or_none()

    if disruption is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Disruption not found in this operator's authorized control territory",
        )

    return disruption


def disruption_payload(
    disruption: DisruptionEvent,
    affected_train_count: int = 0,
    alternative_count: int = 0,
) -> dict:
    job = disruption.maintenance_job

    return {
        "id": disruption.id,
        "disruption_code": disruption.disruption_code,
        "status": disruption.status.value if disruption.status else None,
        "reason": disruption.reason,
        "severity": disruption.severity.value if disruption.severity else None,
        "expected_start": disruption.expected_start,
        "expected_end": disruption.expected_end,
        "estimated_delay_minutes": disruption.estimated_delay_minutes,
        "created_at": disruption.created_at,
        "resolved_at": disruption.resolved_at,
        "maintenance_job_id": disruption.maintenance_job_id,
        "track_segment_id": disruption.track_segment_id,
        "job": (
            {
                "id": job.id,
                "job_code": job.job_code,
                "title": job.title,
                "description": job.description,
                "severity": job.severity.value if job.severity else None,
                "status": job.status.value if job.status else None,
                "priority_score": job.priority_score,
                "estimated_delay_minutes": job.estimated_delay_minutes,
                "expected_train_impact": job.expected_train_impact,
                "planned_start": job.planned_start,
                "planned_end": job.planned_end,
                "latitude": None,
                "longitude": None,
                "km_marker": job.km_marker,
            }
            if job
            else None
        ),
        "affected_train_count": affected_train_count,
        "alternative_count": alternative_count,
    }


def affected_train_payload(
    train: AffectedTrain,
    ml_delay: float | None = None,
    delay_source: str | None = None,
) -> dict:
    return {
        "id": train.id,
        "disruption_id": train.disruption_id,
        "train_id": train.train_id,
        "train_number": train.train_number,
        "train_name": train.train_name,
        "scheduled_passage": train.scheduled_passage,
        "predicted_delay_minutes": (
            ml_delay
            if ml_delay is not None
            else train.predicted_delay_minutes
        ),
        "delay_source": (
            delay_source
            or (
                "ML_MODEL"
                if ml_delay is not None
                else "DATABASE_PREDICTION_CACHE"
            )
        ),
        "priority_class": train.priority_class,
    }


def alternative_payload(alternative: RouteAlternative) -> dict:
    return {
        "id": alternative.id,
        "disruption_id": alternative.disruption_id,
        "alternative_code": alternative.alternative_code,
        "action_type": alternative.action_type,
        "title": alternative.title,
        "description": alternative.description,
        "predicted_delay_minutes": alternative.predicted_delay_minutes,
        "predicted_cost": alternative.predicted_cost,
        "conflict_count": alternative.conflict_count,
        "feasibility_score": alternative.feasibility_score,
        "ml_rank_score": alternative.ml_rank_score,
        "is_feasible": alternative.is_feasible,
        "status": alternative.status.value if alternative.status else None,
        "generated_reason": alternative.generated_reason,
        "selected_by_user_id": alternative.selected_by_user_id,
        "selected_at": alternative.selected_at,
        "created_at": alternative.created_at,
    }


@router.get("/operator/me")
async def get_operator_me(
    current_user: User = Depends(get_current_user),
):
    require_operator(current_user)

    return {
        "user_id": current_user.id,
        "employee_id": current_user.employee_id,
        "full_name": current_user.full_name,
        "role": current_user.role.value,
        "zone": current_user.zone,
        "division": current_user.division,
        "control_scope": operator_scope_label(current_user),
        "national_access": is_national_operator(current_user),
    }


@router.get("/operator/summary")
async def get_operator_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_operator(current_user)

    active_statuses = [
        DisruptionStatus.OPEN,
        DisruptionStatus.EVALUATING,
        DisruptionStatus.ACTION_SELECTED,
    ]

    disruption_ids_query = select(DisruptionEvent.id).where(
        DisruptionEvent.status.in_(active_statuses)
    )
    disruption_ids_query = apply_operator_scope(disruption_ids_query, current_user)
    scoped_ids = disruption_ids_query.subquery()

    open_count = await db.scalar(select(func.count()).select_from(scoped_ids))
    affected_count = await db.scalar(
        select(func.count(AffectedTrain.id)).where(
            AffectedTrain.disruption_id.in_(select(scoped_ids.c.id))
        )
    )
    recommended_count = await db.scalar(
        select(func.count(RouteAlternative.id)).where(
            RouteAlternative.disruption_id.in_(select(scoped_ids.c.id)),
            RouteAlternative.status == AlternativeStatus.RECOMMENDED,
        )
    )
    average_delay = await db.scalar(
        select(func.avg(AffectedTrain.predicted_delay_minutes)).where(
            AffectedTrain.disruption_id.in_(select(scoped_ids.c.id)),
            AffectedTrain.predicted_delay_minutes.is_not(None),
        )
    )

    return {
        "open_disruptions": int(open_count or 0),
        "affected_trains": int(affected_count or 0),
        "recommended_alternatives": int(recommended_count or 0),
        "average_predicted_delay_minutes": round(float(average_delay or 0.0), 1),
        "data_mode": "DEMO_REPLAY",
        "control_scope": operator_scope_label(current_user),
    }


@router.get("/operator/disruptions")
async def get_disruptions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_operator(current_user)

    affected_count_sq = (
        select(func.count(AffectedTrain.id))
        .where(
            AffectedTrain.disruption_id == DisruptionEvent.id
        )
        .correlate(DisruptionEvent)
        .scalar_subquery()
    )

    alternative_count_sq = (
        select(func.count(RouteAlternative.id))
        .where(
            RouteAlternative.disruption_id == DisruptionEvent.id
        )
        .correlate(DisruptionEvent)
        .scalar_subquery()
    )

    query = (
        select(
            DisruptionEvent,
            affected_count_sq.label("affected_train_count"),
            alternative_count_sq.label("alternative_count"),
        )
        .options(
            selectinload(DisruptionEvent.maintenance_job),
        )
    )

    query = apply_operator_scope(query, current_user)
    query = query.order_by(DisruptionEvent.created_at.desc())
    result = await db.execute(query)

    rows = result.all()

    disruptions = []

    for disruption, affected_count, alternative_count in rows:
        payload = disruption_payload(
            disruption,
            affected_train_count=int(affected_count or 0),
            alternative_count=int(alternative_count or 0),
        )
        disruptions.append(payload)

    return {
        "count": len(disruptions),
        "disruptions": disruptions,
    }


@router.get("/operator/disruptions/{disruption_id}")
async def get_disruption_detail(
    disruption_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_operator(current_user)

    query = (
        select(DisruptionEvent)
        .where(DisruptionEvent.id == disruption_id)
        .options(
            selectinload(DisruptionEvent.maintenance_job),
            selectinload(DisruptionEvent.affected_trains),
            selectinload(DisruptionEvent.alternatives),
        )
    )

    query = apply_operator_scope(query, current_user)
    result = await db.execute(query)

    disruption = result.scalar_one_or_none()

    if disruption is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Disruption not found in this operator control territory",
        )

    return {
        "disruption": disruption_payload(
            disruption,
            affected_train_count=len(
                disruption.affected_trains or []
            ),
            alternative_count=len(
                disruption.alternatives or []
            ),
        ),
        "affected_trains": [
            affected_train_payload(
                item,
                delay_source="DATABASE_PREDICTION_CACHE",
            )
            for item in disruption.affected_trains
        ],
        "alternatives": sorted(
            [
                alternative_payload(item)
                for item in disruption.alternatives
            ],
            key=lambda item: float(
                item.get("ml_rank_score") or 0
            ),
            reverse=True,
        ),
    }


@router.get("/operator/affected-trains")
async def get_affected_trains(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_operator(current_user)

    disruption_ids_query = select(DisruptionEvent.id)
    disruption_ids_query = apply_operator_scope(
        disruption_ids_query,
        current_user,
    )

    result = await db.execute(
        select(AffectedTrain)
        .where(
            AffectedTrain.disruption_id.in_(disruption_ids_query)
        )
        .order_by(
            AffectedTrain.predicted_delay_minutes.desc().nullslast()
        )
    )

    trains = result.scalars().all()

    return {
        "count": len(trains),
        "trains": [
            affected_train_payload(
                train,
                delay_source="DATABASE_PREDICTION_CACHE",
            )
            for train in trains
        ],
        "delay_engine": "DATABASE_PREDICTION_CACHE",
    }


@router.get("/operator/alternatives")
async def get_alternatives(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_operator(current_user)

    disruption_ids_query = select(DisruptionEvent.id)
    disruption_ids_query = apply_operator_scope(
        disruption_ids_query,
        current_user,
    )

    result = await db.execute(
        select(RouteAlternative)
        .where(
            RouteAlternative.disruption_id.in_(disruption_ids_query)
        )
        .order_by(
            RouteAlternative.ml_rank_score.desc().nullslast()
        )
    )

    alternatives = result.scalars().all()

    return {
        "count": len(alternatives),
        "alternatives": [
            alternative_payload(item)
            for item in alternatives
        ],
    }


@router.post("/operator/alternatives/{alternative_id}/select")
async def select_alternative(
    alternative_id: int,
    payload: SelectAlternativeRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_operator(current_user)

    result = await db.execute(
        select(RouteAlternative)
        .where(RouteAlternative.id == alternative_id)
    )

    selected = result.scalar_one_or_none()

    if selected is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Operational alternative not found",
        )

    await require_disruption_in_operator_scope(
        db,
        selected.disruption_id,
        current_user,
    )

    if not selected.is_feasible:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This alternative is currently marked infeasible",
        )

    siblings_result = await db.execute(
        select(RouteAlternative)
        .where(
            RouteAlternative.disruption_id
            == selected.disruption_id
        )
        .order_by(
            RouteAlternative.ml_rank_score.desc().nullslast(),
            RouteAlternative.id.asc(),
        )
    )

    siblings = siblings_result.scalars().all()

    disruption_result = await db.execute(
        select(DisruptionEvent)
        .where(
            DisruptionEvent.id
            == selected.disruption_id
        )
    )

    disruption = disruption_result.scalar_one_or_none()

    # Clicking an already-selected action acts as UNDO.
    if selected.status == AlternativeStatus.SELECTED:
        feasible_ranked = [
            item
            for item in siblings
            if item.is_feasible
        ]

        recommended_id = (
            feasible_ranked[0].id
            if feasible_ranked
            else None
        )

        for item in siblings:
            if item.id == selected.id:
                item.status = (
                    AlternativeStatus.RECOMMENDED
                    if item.id == recommended_id
                    else AlternativeStatus.GENERATED
                )
                item.selected_by_user_id = None
                item.selected_at = None

        if disruption is not None:
            disruption.status = DisruptionStatus.EVALUATING

        await db.commit()
        await db.refresh(selected)

        return {
            "message": "Operational alternative selection cleared",
            "action": "UNSELECTED",
            "note": (
                payload.note
                if payload is not None
                else None
            ),
            "alternative": alternative_payload(selected),
            "disruption_status": (
                disruption.status.value
                if disruption is not None
                else None
            ),
        }

    # Selecting a different action automatically clears any previous selection.
    for item in siblings:
        if item.id == selected.id:
            item.status = AlternativeStatus.SELECTED
            item.selected_by_user_id = current_user.id
            item.selected_at = datetime.now(timezone.utc)
        elif item.status == AlternativeStatus.SELECTED:
            item.status = AlternativeStatus.GENERATED
            item.selected_by_user_id = None
            item.selected_at = None

    if disruption is not None:
        disruption.status = DisruptionStatus.ACTION_SELECTED

    await db.commit()
    await db.refresh(selected)

    return {
        "message": "Operational alternative selected successfully",
        "action": "SELECTED",
        "note": (
            payload.note
            if payload is not None
            else None
        ),
        "alternative": alternative_payload(selected),
        "disruption_status": (
            disruption.status.value
            if disruption is not None
            else None
        ),
    }


@router.post("/operator/disruptions/{disruption_id}/resolve")
async def resolve_disruption(
    disruption_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_operator(current_user)

    disruption = await require_disruption_in_operator_scope(
        db,
        disruption_id,
        current_user,
    )

    if disruption.status == DisruptionStatus.RESOLVED:
        return {
            "message": "Disruption is already resolved",
            "disruption_id": disruption.id,
            "status": disruption.status.value,
        }

    disruption.status = DisruptionStatus.RESOLVED
    disruption.resolved_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(disruption)

    return {
        "message": "Disruption resolved successfully",
        "disruption_id": disruption.id,
        "status": disruption.status.value,
        "resolved_at": disruption.resolved_at,
    }


@router.get("/operator/ml/status")
async def get_operator_ml_status(
    current_user: User = Depends(get_current_user),
):
    require_operator(current_user)
    return model_status()
