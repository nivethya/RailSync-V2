import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.operations import (
    AffectedTrain,
    DisruptionEvent,
    DisruptionStatus,
    MaintenanceJob,
)


# =========================================================
# DEMO / REPLAY TRAIN TEMPLATES
# =========================================================

TRAIN_TEMPLATES = [
    {
        "number_base": 12600,
        "name": "RailSync Express - DEMO_REPLAY",
        "priority_class": "EXPRESS",
        "delay_factor": 1.00,
    },
    {
        "number_base": 66000,
        "name": "RailSync Local - DEMO_REPLAY",
        "priority_class": "LOCAL",
        "delay_factor": 0.72,
    },
    {
        "number_base": 12000,
        "name": "RailSync Superfast - DEMO_REPLAY",
        "priority_class": "SUPERFAST",
        "delay_factor": 1.18,
    },
]


# =========================================================
# MAIN BACKFILL
# =========================================================

async def backfill_affected_trains():
    async with AsyncSessionLocal() as db:

        result = await db.execute(
            select(DisruptionEvent)
            .where(
                DisruptionEvent.status.in_(
                    [
                        DisruptionStatus.OPEN,
                        DisruptionStatus.EVALUATING,
                        DisruptionStatus.ACTION_SELECTED,
                    ]
                )
            )
            .order_by(
                DisruptionEvent.id.asc()
            )
        )

        disruptions = result.scalars().all()

        print()
        print("=" * 70)
        print("RailSync Operator Disruption Backfill")
        print("=" * 70)
        print(
            f"Found {len(disruptions)} active disruptions."
        )
        print()

        created_total = 0
        skipped_total = 0

        for disruption in disruptions:

            # -------------------------------------------------
            # Check if this disruption already has trains
            # -------------------------------------------------

            train_result = await db.execute(
                select(AffectedTrain).where(
                    AffectedTrain.disruption_id
                    == disruption.id
                )
            )

            existing_trains = (
                train_result.scalars().all()
            )

            if existing_trains:
                print(
                    f"[SKIP] "
                    f"{disruption.disruption_code} "
                    f"already has "
                    f"{len(existing_trains)} "
                    f"affected train(s)."
                )

                skipped_total += 1
                continue

            # -------------------------------------------------
            # Get linked maintenance job
            # -------------------------------------------------

            job = None

            if disruption.maintenance_job_id:

                job_result = await db.execute(
                    select(MaintenanceJob).where(
                        MaintenanceJob.id
                        == disruption.maintenance_job_id
                    )
                )

                job = (
                    job_result.scalar_one_or_none()
                )

            # -------------------------------------------------
            # Determine base delay
            # -------------------------------------------------

            base_delay = float(
                disruption.estimated_delay_minutes
                or (
                    job.estimated_delay_minutes
                    if job
                    else 0
                )
                or 12.0
            )

            if base_delay <= 0:
                base_delay = 12.0

            # -------------------------------------------------
            # Determine passage reference time
            # -------------------------------------------------

            passage_base = (
                disruption.expected_start
                or (
                    job.planned_start
                    if job
                    else None
                )
                or datetime.now(timezone.utc)
            )

            # -------------------------------------------------
            # Create 3 DEMO_REPLAY affected trains
            # -------------------------------------------------

            for index, template in enumerate(
                TRAIN_TEMPLATES
            ):

                train_number = str(
                    template["number_base"]
                    + (
                        disruption.id
                        % 80
                    )
                    + index
                )

                passage_time = (
                    passage_base
                    + timedelta(
                        minutes=15 * (index + 1)
                    )
                )

                predicted_delay = round(
                    max(
                        base_delay
                        * template[
                            "delay_factor"
                        ],
                        2.0,
                    ),
                    1,
                )

                train = AffectedTrain(
                    disruption_id=disruption.id,

                    # We are using DEMO_REPLAY data,
                    # so no real Train FK is required.
                    train_id=None,

                    train_number=train_number,

                    train_name=template["name"],

                    scheduled_passage=passage_time,

                    predicted_delay_minutes=(
                        predicted_delay
                    ),

                    priority_class=template[
                        "priority_class"
                    ],
                )

                db.add(train)

                created_total += 1

            print(
                f"[CREATED] "
                f"{disruption.disruption_code} "
                f"→ 3 affected trains"
            )

        # -----------------------------------------------------
        # Save everything
        # -----------------------------------------------------

        try:
            await db.commit()

        except Exception:
            await db.rollback()
            raise

        print()
        print("=" * 70)
        print("BACKFILL COMPLETE")
        print("=" * 70)

        print(
            f"Created affected trains : "
            f"{created_total}"
        )

        print(
            f"Skipped disruptions     : "
            f"{skipped_total}"
        )

        print()

        print(
            "DATA MODE: DEMO_REPLAY"
        )

        print(
            "These records are prototype "
            "operational replay data and are "
            "not claimed as live RTIS data."
        )

        print("=" * 70)
        print()


# =========================================================
# ENTRY POINT
# =========================================================

if __name__ == "__main__":
    asyncio.run(
        backfill_affected_trains()
    )