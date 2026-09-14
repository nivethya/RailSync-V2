from __future__ import annotations

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.manager_operations import require_manager
from app.core.database import get_db
from app.models.user import User
from app.services.block_planner import (
    AutomaticBlockPlanner,
    PlannerConfig,
)


router = APIRouter(
    prefix="/api/v1/manager/block-planning",
    tags=["manager-block-planning"],
)


class GenerateBlockPlanRequest(BaseModel):
    corridor_id: int | None = None
    track_segment_id: int | None = None
    horizon_hours: int = Field(
        default=24,
        ge=1,
        le=72,
    )
    slot_minutes: int = Field(
        default=30,
        ge=15,
        le=120,
    )
    max_candidates_per_group: int = Field(
        default=4,
        ge=1,
        le=8,
    )
    clubbing_window_minutes: int = Field(
        default=120,
        ge=30,
        le=360,
    )


@router.get("/health")
async def block_planner_health(
    _: User = Depends(require_manager),
):
    return {
        "status": "ready",
        "engine": (
            "RAILSYNC_AUTOMATIC_BLOCK_PLANNER_V1"
        ),
        "human_approval_required": True,
        "data_mode": "DEMO_REPLAY",
    }


@router.post("/generate")
async def generate_block_plan(
    payload: GenerateBlockPlanRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    planner = AutomaticBlockPlanner(
        db,
        PlannerConfig(
            horizon_hours=(
                payload.horizon_hours
            ),
            slot_minutes=(
                payload.slot_minutes
            ),
            max_candidates_per_group=(
                payload.max_candidates_per_group
            ),
            clubbing_window_minutes=(
                payload.clubbing_window_minutes
            ),
        ),
    )

    return await planner.generate(
        corridor_id=payload.corridor_id,
        track_segment_id=(
            payload.track_segment_id
        ),
    )


@router.get("/preview")
async def preview_block_plan(
    corridor_id: int | None = None,
    track_segment_id: int | None = None,
    horizon_hours: int = 24,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    planner = AutomaticBlockPlanner(
        db,
        PlannerConfig(
            horizon_hours=max(
                1,
                min(
                    horizon_hours,
                    72,
                ),
            ),
        ),
    )

    return await planner.generate(
        corridor_id=corridor_id,
        track_segment_id=track_segment_id,
    )
