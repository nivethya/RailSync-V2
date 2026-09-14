from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
MANAGER = ROOT / "app" / "api" / "routes" / "manager_operations.py"
OPERATOR = ROOT / "app" / "api" / "routes" / "operator_operations.py"

for target in (MANAGER, OPERATOR):
    if not target.exists():
        raise SystemExit(f"Missing file: {target}")

def ensure_backup(path: Path):
    backup = path.with_suffix(path.suffix + ".before_ml_integration")
    if not backup.exists():
        backup.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")

# =========================================================
# MANAGER PATCH
# =========================================================
ensure_backup(MANAGER)
text = MANAGER.read_text(encoding="utf-8")

if "from app.services.ml_service import" not in text:
    anchor = "from app.websocket.realtime_manager import"
    idx = text.find(anchor)
    if idx == -1:
        raise SystemExit("Manager import anchor not found")

    text = (
        text[:idx]
        + "from app.services.ml_service import (\n"
          "    model_status,\n"
          "    predict_maintenance_priority,\n"
          "    predict_worker_suitability,\n"
          ")\n\n"
        + text[idx:]
    )

# Patch GET /jobs response loop to calculate ML priority.
old_jobs = """    response = []

    for job in jobs:
        response.append(
            await job_to_dict(
                db,
                job,
            )
        )

    return {
        "count": len(response),
        "jobs": response,
    }
"""
new_jobs = """    response = []

    for job in jobs:
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

        response.append(item)

    response.sort(
        key=lambda item: float(
            item.get("priority_score") or 0
        ),
        reverse=True,
    )

    return {
        "count": len(response),
        "jobs": response,
        "priority_engine": "ML_MODEL",
    }
"""

if old_jobs in text:
    text = text.replace(old_jobs, new_jobs, 1)

# Patch GET /jobs/{job_id}.
old_single = """    return await job_to_dict(
        db,
        job,
    )
"""
new_single = """    item = await job_to_dict(
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
"""

# Only replace the first exact single-job return after get_job.
if old_single in text:
    text = text.replace(old_single, new_single, 1)

# Patch worker suitability scoring.
old_score = """        proficiency_score = (
            proficiency / 5
        ) * 100

        availability_score = (
            100
            if availability.status
            == WorkerAvailabilityStatus.AVAILABLE
            else 70
        )

        workload_score = (
            remaining_minutes
            / max_daily_minutes
            * 100
            if max_daily_minutes > 0
            else 0
        )

        suitability_score = round(
            (
                proficiency_score * 0.50
                + availability_score * 0.25
                + workload_score * 0.25
            ),
            2,
        )
"""
new_score = """        try:
            suitability_score = predict_worker_suitability(
                job=job,
                worker=worker,
                availability=availability,
                proficiency_level=proficiency,
                has_required_skill=True,
                same_zone=False,
            )

            suitability_source = "ML_MODEL"

        except Exception:
            proficiency_score = (
                proficiency / 5
            ) * 100

            availability_score = (
                100
                if availability.status
                == WorkerAvailabilityStatus.AVAILABLE
                else 70
            )

            workload_score = (
                remaining_minutes
                / max_daily_minutes
                * 100
                if max_daily_minutes > 0
                else 0
            )

            suitability_score = round(
                (
                    proficiency_score * 0.50
                    + availability_score * 0.25
                    + workload_score * 0.25
                ),
                2,
            )

            suitability_source = "HEURISTIC_FALLBACK"
"""

if old_score in text:
    text = text.replace(old_score, new_score, 1)

payload_anchor = '                "suitability_score": suitability_score,\n'
if (
    payload_anchor in text
    and '"suitability_source": suitability_source' not in text
):
    text = text.replace(
        payload_anchor,
        payload_anchor
        + '                "suitability_source": suitability_source,\n',
        1,
    )

if '@router.get("/ml/status")' not in text:
    text += """

# =========================================================
# ML STATUS
# =========================================================

@router.get("/ml/status")
async def get_ml_status(
    _: User = Depends(require_manager),
):
    return model_status()
"""

MANAGER.write_text(text, encoding="utf-8")

# =========================================================
# OPERATOR PATCH
# =========================================================
ensure_backup(OPERATOR)
text = OPERATOR.read_text(encoding="utf-8")

if "from app.services.ml_service import" not in text:
    anchor = "from app.models.user import"
    idx = text.find(anchor)
    if idx == -1:
        raise SystemExit("Operator import anchor not found")

    text = (
        text[:idx]
        + "from app.services.ml_service import (\n"
          "    model_status,\n"
          "    predict_train_delay,\n"
          ")\n\n"
        + text[idx:]
    )

old_payload = """def affected_train_payload(train: AffectedTrain) -> dict:
    return {
        "id": train.id,
        "disruption_id": train.disruption_id,
        "train_id": train.train_id,
        "train_number": train.train_number,
        "train_name": train.train_name,
        "scheduled_passage": train.scheduled_passage,
        "predicted_delay_minutes": train.predicted_delay_minutes,
        "priority_class": train.priority_class,
    }
"""

new_payload = """def affected_train_payload(
    train: AffectedTrain,
    ml_delay: float | None = None,
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
            "ML_MODEL"
            if ml_delay is not None
            else "DATABASE_FALLBACK"
        ),
        "priority_class": train.priority_class,
    }
"""

if old_payload in text:
    text = text.replace(old_payload, new_payload, 1)

old_affected_endpoint = """    return {
        "count": len(trains),
        "trains": [
            affected_train_payload(item)
            for item in trains
        ],
    }
"""

new_affected_endpoint = """    disruption_result = await db.execute(
        select(DisruptionEvent)
    )

    disruptions = disruption_result.scalars().all()

    disruption_by_id = {
        item.id: item
        for item in disruptions
    }

    response = []

    for train in trains:
        disruption = disruption_by_id.get(
            train.disruption_id
        )

        ml_delay = None

        if disruption is not None:
            try:
                ml_delay = predict_train_delay(
                    disruption=disruption,
                    train=train,
                )
            except Exception:
                ml_delay = None

        response.append(
            affected_train_payload(
                train,
                ml_delay,
            )
        )

    return {
        "count": len(response),
        "trains": response,
        "delay_engine": "ML_MODEL",
    }
"""

if old_affected_endpoint in text:
    text = text.replace(
        old_affected_endpoint,
        new_affected_endpoint,
        1,
    )

# Patch detailed disruption endpoint affected-train list.
old_detail = """        "affected_trains": [
            affected_train_payload(item)
            for item in disruption.affected_trains
        ],
"""

new_detail = """        "affected_trains": [
            affected_train_payload(
                item,
                (
                    predict_train_delay(
                        disruption=disruption,
                        train=item,
                    )
                ),
            )
            for item in disruption.affected_trains
        ],
"""

if old_detail in text:
    text = text.replace(old_detail, new_detail, 1)

if '@router.get("/operator/ml/status")' not in text:
    text += """

@router.get("/operator/ml/status")
async def get_operator_ml_status(
    current_user: User = Depends(get_current_user),
):
    require_operator(current_user)
    return model_status()
"""

OPERATOR.write_text(text, encoding="utf-8")

print("SUCCESS")
print("Manager:", MANAGER)
print("Operator:", OPERATOR)
print("Backups created with .before_ml_integration suffix")
print()
print("Now run:")
print(r"python -m py_compile .\app\services\ml_service.py")
print(r"python -m py_compile .\app\api\routes\manager_operations.py")
print(r"python -m py_compile .\app\api\routes\operator_operations.py")
