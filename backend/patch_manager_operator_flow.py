from pathlib import Path

TARGET = Path("app/api/routes/manager_operations.py")

if not TARGET.exists():
    raise SystemExit(
        "ERROR: app/api/routes/manager_operations.py was not found. "
        "Run this script from the RailSync-V2/backend folder."
    )

text = TARGET.read_text(encoding="utf-8")

start_marker = '@router.post(\n    "/extension-requests/{request_id}/approve"\n)'
end_marker = '# =========================================================\n# REJECT EXTENSION\n# ========================================================='

start = text.find(start_marker)
end = text.find(end_marker)

if start == -1:
    raise SystemExit("ERROR: approve_extension route block was not found.")

if end == -1 or end <= start:
    raise SystemExit("ERROR: REJECT EXTENSION marker was not found.")

replacement = r'''@router.post(
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


'''

patched = text[:start] + replacement + text[end:]

backup = TARGET.with_suffix(".py.before_operator_flow")
backup.write_text(text, encoding="utf-8")
TARGET.write_text(patched, encoding="utf-8")

print("SUCCESS")
print("Patched:", TARGET)
print("Backup :", backup)
print("")
print("Next run:")
print("python -m py_compile .\\app\\api\\routes\\manager_operations.py")
