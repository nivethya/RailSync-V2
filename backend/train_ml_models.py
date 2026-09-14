from __future__ import annotations

import asyncio
import random
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.operations import (
    AffectedTrain,
    DisruptionEvent,
    MaintenanceJob,
    RailwayCorridor,
    TrackSegment,
    WorkerAssignment,
    WorkerAvailability,
    WorkerAvailabilityStatus,
    WorkerProfile,
    WorkerSkill,
)

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR = ROOT / "ml" / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

RANDOM_STATE = 42
random.seed(RANDOM_STATE)
np.random.seed(RANDOM_STATE)


def safe_num(value, default=0.0):
    try:
        if value is None:
            return float(default)
        return float(value)
    except Exception:
        return float(default)


def enum_value(value):
    return getattr(value, "value", value)


def fit_regression_model(
    df: pd.DataFrame,
    target: str,
    categorical: list[str],
    numerical: list[str],
    filename: str,
):
    X = df[categorical + numerical].copy()
    y = df[target].astype(float).copy()

    pre = ColumnTransformer(
        transformers=[
            (
                "cat",
                OneHotEncoder(
                    handle_unknown="ignore",
                    sparse_output=False,
                ),
                categorical,
            ),
            (
                "num",
                "passthrough",
                numerical,
            ),
        ],
        remainder="drop",
    )

    model = RandomForestRegressor(
        n_estimators=180,
        random_state=RANDOM_STATE,
        n_jobs=-1,
        min_samples_leaf=1,
    )

    pipe = Pipeline(
        steps=[
            ("preprocessor", pre),
            ("model", model),
        ]
    )

    split = max(1, int(len(df) * 0.8))

    train_df = df.iloc[:split].copy()
    test_df = df.iloc[split:].copy()

    X_train = train_df[categorical + numerical]
    y_train = train_df[target].astype(float)

    pipe.fit(X_train, y_train)

    if len(test_df) > 0:
        X_test = test_df[categorical + numerical]
        y_test = test_df[target].astype(float)

        pred = pipe.predict(X_test)

        mae = mean_absolute_error(y_test, pred)

        try:
            r2 = r2_score(y_test, pred)
        except Exception:
            r2 = float("nan")
    else:
        mae = float("nan")
        r2 = float("nan")

    # Fit on full dataset after validation.
    pipe.fit(X, y)

    out = MODEL_DIR / filename
    joblib.dump(pipe, out)

    print()
    print("=" * 72)
    print(filename)
    print("Rows:", len(df))
    print("Features:", categorical + numerical)
    print("MAE:", round(float(mae), 4) if np.isfinite(mae) else "N/A")
    print("R2 :", round(float(r2), 4) if np.isfinite(r2) else "N/A")
    print("Saved:", out)

    return pipe


async def build_maintenance_priority_dataset():
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(MaintenanceJob)
            .order_by(MaintenanceJob.id.asc())
        )
        jobs = result.scalars().all()

    rows = []

    for job in jobs:
        severity = str(enum_value(job.severity) or "MEDIUM")
        severity_weight = {
            "LOW": 20,
            "MEDIUM": 45,
            "HIGH": 72,
            "CRITICAL": 95,
        }.get(severity, 45)

        target = safe_num(
            job.priority_score,
            severity_weight
            + safe_num(job.predicted_failure_risk) * 15
            + safe_num(job.estimated_delay_minutes) * 0.6,
        )

        rows.append(
            {
                "severity": severity,
                "asset_type": str(job.asset_type or "UNKNOWN"),
                "job_type": str(job.job_type or "UNKNOWN"),
                "required_skill": str(job.required_skill or "UNKNOWN"),
                "required_authority": str(job.required_authority or "NONE"),
                "estimated_minutes": safe_num(job.estimated_minutes),
                "predicted_failure_risk": safe_num(job.predicted_failure_risk),
                "estimated_delay_minutes": safe_num(job.estimated_delay_minutes),
                "expected_train_impact": safe_num(job.expected_train_impact),
                "block_required": 1.0 if job.block_required else 0.0,
                "priority_target": target,
            }
        )

    return pd.DataFrame(rows)


async def latest_availability_map(db):
    result = await db.execute(
        select(WorkerAvailability)
        .order_by(
            WorkerAvailability.worker_id.asc(),
            WorkerAvailability.updated_at.desc(),
        )
    )
    records = result.scalars().all()

    latest = {}

    for item in records:
        latest.setdefault(
            item.worker_id,
            item,
        )

    return latest


async def build_worker_assignment_dataset():
    async with AsyncSessionLocal() as db:
        worker_result = await db.execute(
            select(WorkerProfile)
            .where(WorkerProfile.is_active.is_(True))
            .order_by(WorkerProfile.id.asc())
        )
        workers = worker_result.scalars().all()

        job_result = await db.execute(
            select(MaintenanceJob)
            .order_by(MaintenanceJob.id.asc())
        )
        jobs = job_result.scalars().all()

        segment_result = await db.execute(
            select(TrackSegment)
        )
        segments = segment_result.scalars().all()

        corridor_result = await db.execute(
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

        skills_result = await db.execute(
            select(WorkerSkill)
            .where(WorkerSkill.is_certified.is_(True))
        )
        skills = skills_result.scalars().all()

        assignment_result = await db.execute(
            select(WorkerAssignment)
        )
        assignments = assignment_result.scalars().all()

        latest_availability = await latest_availability_map(db)

    skills_by_worker: dict[int, list[WorkerSkill]] = {}

    for skill in skills:
        skills_by_worker.setdefault(
            skill.worker_id,
            [],
        ).append(skill)

    assignment_score = {
        (a.worker_id, a.maintenance_job_id): safe_num(a.suitability_score, -1)
        for a in assignments
    }

    rows = []

    candidate_jobs = jobs[: min(len(jobs), 500)]

    for job in candidate_jobs:
        # Sample workers to keep training fast.
        candidate_workers = random.sample(
            workers,
            min(len(workers), 80),
        )

        for worker in candidate_workers:
            worker_skills = skills_by_worker.get(worker.id, [])

            matching = None

            for skill in worker_skills:
                if str(skill.skill_code) != str(job.required_skill):
                    continue

                if (
                    job.required_authority is not None
                    and str(skill.authority_code)
                    != str(job.required_authority)
                ):
                    continue

                matching = skill
                break

            availability = latest_availability.get(worker.id)

            availability_value = (
                str(enum_value(availability.status))
                if availability
                else "UNAVAILABLE"
            )

            has_required_skill = 1.0 if matching else 0.0

            proficiency = safe_num(
                matching.proficiency_level if matching else 0
            )

            experience = safe_num(worker.years_experience)

            max_daily = safe_num(worker.max_daily_minutes, 360)

            estimated = safe_num(job.estimated_minutes, 60)

            segment = segment_by_id.get(
                job.track_segment_id
            )

            corridor = (
                corridor_by_id.get(segment.corridor_id)
                if segment is not None
                else None
            )

            same_zone = 1.0 if (
                worker.railway_zone
                and corridor is not None
                and worker.railway_zone == corridor.zone
            ) else 0.0

            availability_score = {
                "AVAILABLE": 100.0,
                "PARTIAL": 70.0,
                "UNAVAILABLE": 0.0,
            }.get(availability_value, 0.0)

            capacity_ratio = (
                min(
                    1.0,
                    max_daily / max(estimated, 1.0),
                )
                * 100.0
            )

            heuristic = (
                has_required_skill * 45.0
                + (proficiency / 5.0) * 25.0
                + availability_score * 0.18
                + min(experience, 20.0) / 20.0 * 7.0
                + same_zone * 5.0
            )

            if estimated > max_daily:
                heuristic -= 25.0

            historical = assignment_score.get(
                (worker.id, job.id),
                -1,
            )

            target = (
                historical
                if historical >= 0
                else max(
                    0.0,
                    min(
                        100.0,
                        heuristic,
                    ),
                )
            )

            rows.append(
                {
                    "job_severity": str(enum_value(job.severity) or "MEDIUM"),
                    "required_skill": str(job.required_skill or "UNKNOWN"),
                    "required_authority": str(job.required_authority or "NONE"),
                    "worker_department": str(worker.department or "UNKNOWN"),
                    "worker_zone": str(worker.railway_zone or "UNKNOWN"),
                    "availability": availability_value,
                    "estimated_minutes": estimated,
                    "worker_experience_years": experience,
                    "proficiency_level": proficiency,
                    "has_required_skill": has_required_skill,
                    "max_daily_minutes": max_daily,
                    "same_zone": same_zone,
                    "suitability_target": target,
                }
            )

    return pd.DataFrame(rows)


async def build_train_delay_dataset():
    async with AsyncSessionLocal() as db:
        affected_result = await db.execute(
            select(AffectedTrain)
            .order_by(AffectedTrain.id.asc())
        )
        affected = affected_result.scalars().all()

        disruption_result = await db.execute(
            select(DisruptionEvent)
        )
        disruptions = disruption_result.scalars().all()

    disruption_by_id = {
        item.id: item
        for item in disruptions
    }

    rows = []

    for train in affected:
        disruption = disruption_by_id.get(
            train.disruption_id
        )

        severity = str(
            enum_value(
                getattr(disruption, "severity", None)
            )
            or "MEDIUM"
        )

        disruption_delay = safe_num(
            getattr(
                disruption,
                "estimated_delay_minutes",
                0,
            )
        )

        priority = str(
            train.priority_class
            or "NORMAL"
        )

        scheduled_passage = train.scheduled_passage

        hour = (
            float(scheduled_passage.hour)
            if scheduled_passage
            else 12.0
        )

        target = safe_num(
            train.predicted_delay_minutes,
            disruption_delay,
        )

        rows.append(
            {
                "disruption_severity": severity,
                "priority_class": priority,
                "disruption_estimated_delay": disruption_delay,
                "hour_of_day": hour,
                "is_peak_hour": 1.0 if hour in list(range(7, 11)) + list(range(17, 22)) else 0.0,
                "train_delay_target": target,
            }
        )

    # If operational seed has too few affected trains,
    # augment from the real disruption values already in the DB.
    if len(rows) < 300 and disruptions:
        base_rows = rows.copy()

        for disruption in disruptions:
            severity = str(
                enum_value(disruption.severity)
                or "MEDIUM"
            )

            base_delay = safe_num(
                disruption.estimated_delay_minutes,
                {
                    "LOW": 5,
                    "MEDIUM": 12,
                    "HIGH": 22,
                    "CRITICAL": 35,
                }.get(severity, 12),
            )

            for priority, factor in [
                ("LOCAL", 0.80),
                ("EXPRESS", 1.00),
                ("SUPERFAST", 1.12),
                ("PREMIUM", 0.92),
            ]:
                for hour in [6, 8, 10, 13, 17, 19, 22]:
                    congestion = 1.18 if hour in [8, 17, 19] else 1.0

                    target = max(
                        0.0,
                        base_delay
                        * factor
                        * congestion
                        + random.uniform(-2.5, 2.5),
                    )

                    base_rows.append(
                        {
                            "disruption_severity": severity,
                            "priority_class": priority,
                            "disruption_estimated_delay": base_delay,
                            "hour_of_day": float(hour),
                            "is_peak_hour": 1.0 if hour in [8, 17, 19] else 0.0,
                            "train_delay_target": round(target, 2),
                        }
                    )

        rows = base_rows

    return pd.DataFrame(rows)


async def main():
    print("RailSync ML Training")
    print("Model output:", MODEL_DIR)

    maintenance_df = await build_maintenance_priority_dataset()

    if maintenance_df.empty:
        raise RuntimeError(
            "No maintenance jobs found. Run the operational seed first."
        )

    maintenance_model_path = MODEL_DIR / "maintenance_priority_model.joblib"

    if maintenance_model_path.exists():
        print()
        print("=" * 72)
        print("maintenance_priority_model.joblib")
        print("Existing model found - keeping it to save time.")
        print("Saved:", maintenance_model_path)
    else:
        fit_regression_model(
            maintenance_df,
            target="priority_target",
        categorical=[
            "severity",
            "asset_type",
            "job_type",
            "required_skill",
            "required_authority",
        ],
        numerical=[
            "estimated_minutes",
            "predicted_failure_risk",
            "estimated_delay_minutes",
            "expected_train_impact",
            "block_required",
        ],
            filename="maintenance_priority_model.joblib",
        )

    worker_df = await build_worker_assignment_dataset()

    if worker_df.empty:
        raise RuntimeError(
            "No worker/job training candidates found."
        )

    fit_regression_model(
        worker_df,
        target="suitability_target",
        categorical=[
            "job_severity",
            "required_skill",
            "required_authority",
            "worker_department",
            "worker_zone",
            "availability",
        ],
        numerical=[
            "estimated_minutes",
            "worker_experience_years",
            "proficiency_level",
            "has_required_skill",
            "max_daily_minutes",
            "same_zone",
        ],
        filename="worker_assignment_model.joblib",
    )

    delay_df = await build_train_delay_dataset()

    if delay_df.empty:
        raise RuntimeError(
            "No train disruption records found. "
            "Run the operational large-scale seed first."
        )

    fit_regression_model(
        delay_df,
        target="train_delay_target",
        categorical=[
            "disruption_severity",
            "priority_class",
        ],
        numerical=[
            "disruption_estimated_delay",
            "hour_of_day",
            "is_peak_hour",
        ],
        filename="train_delay_model.joblib",
    )

    print()
    print("=" * 72)
    print("ALL MODELS TRAINED")
    print("=" * 72)

    for path in sorted(MODEL_DIR.glob("*.joblib")):
        print(
            path.name,
            round(path.stat().st_size / 1024 / 1024, 2),
            "MB",
        )


if __name__ == "__main__":
    asyncio.run(main())
