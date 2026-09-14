"""add operational maintenance workflow

FIXED VERSION: no duplicate PostGIS spatial-index creation

Revision ID: 6b7f0a9c2d11
Revises: 5050ac158dad
Create Date: 2026-09-06

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2


# revision identifiers, used by Alembic.
revision: str = "6b7f0a9c2d11"
down_revision: Union[str, Sequence[str], None] = "5050ac158dad"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # =========================================================
    # railway_corridors
    # =========================================================
    op.create_table(
        "railway_corridors",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("corridor_code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("zone", sa.String(length=120), nullable=True),
        sa.Column("division", sa.String(length=120), nullable=True),
        sa.Column("start_station_code", sa.String(length=20), nullable=True),
        sa.Column("start_station_name", sa.String(length=150), nullable=True),
        sa.Column("end_station_code", sa.String(length=20), nullable=True),
        sa.Column("end_station_name", sa.String(length=150), nullable=True),
        sa.Column("state_from", sa.String(length=100), nullable=True),
        sa.Column("state_to", sa.String(length=100), nullable=True),
        sa.Column("total_length_km", sa.Float(), nullable=True),
        sa.Column(
            "geometry",
            geoalchemy2.types.Geometry(
                geometry_type="LINESTRING",
                srid=4326,
                dimension=2,
                spatial_index=False,
                from_text="ST_GeomFromEWKT",
                name="geometry",
            ),
            nullable=True,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("corridor_code"),
    )

    op.create_index(
        op.f("ix_railway_corridors_id"),
        "railway_corridors",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_railway_corridors_corridor_code"),
        "railway_corridors",
        ["corridor_code"],
        unique=False,
    )
    op.create_index(
        op.f("ix_railway_corridors_name"),
        "railway_corridors",
        ["name"],
        unique=False,
    )
    op.create_index(
        op.f("ix_railway_corridors_zone"),
        "railway_corridors",
        ["zone"],
        unique=False,
    )
    op.create_index(
        op.f("ix_railway_corridors_division"),
        "railway_corridors",
        ["division"],
        unique=False,
    )
    op.create_index(
        op.f("ix_railway_corridors_start_station_code"),
        "railway_corridors",
        ["start_station_code"],
        unique=False,
    )
    op.create_index(
        op.f("ix_railway_corridors_end_station_code"),
        "railway_corridors",
        ["end_station_code"],
        unique=False,
    )

    # =========================================================
    # track_segments
    # =========================================================
    op.create_table(
        "track_segments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("corridor_id", sa.Integer(), nullable=False),
        sa.Column("segment_code", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("from_station_code", sa.String(length=20), nullable=True),
        sa.Column("from_station_name", sa.String(length=150), nullable=True),
        sa.Column("to_station_code", sa.String(length=20), nullable=True),
        sa.Column("to_station_name", sa.String(length=150), nullable=True),
        sa.Column("line_name", sa.String(length=100), nullable=True),
        sa.Column("track_number", sa.String(length=40), nullable=True),
        sa.Column("direction", sa.String(length=30), nullable=True),
        sa.Column("electrified", sa.Boolean(), nullable=True),
        sa.Column("max_speed_kmph", sa.Float(), nullable=True),
        sa.Column("length_km", sa.Float(), nullable=True),
        sa.Column(
            "geometry",
            geoalchemy2.types.Geometry(
                geometry_type="LINESTRING",
                srid=4326,
                dimension=2,
                spatial_index=False,
                from_text="ST_GeomFromEWKT",
                name="geometry",
            ),
            nullable=True,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["corridor_id"],
            ["railway_corridors.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("segment_code"),
    )

    op.create_index(
        op.f("ix_track_segments_id"),
        "track_segments",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_track_segments_corridor_id"),
        "track_segments",
        ["corridor_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_track_segments_segment_code"),
        "track_segments",
        ["segment_code"],
        unique=False,
    )
    op.create_index(
        op.f("ix_track_segments_from_station_code"),
        "track_segments",
        ["from_station_code"],
        unique=False,
    )
    op.create_index(
        op.f("ix_track_segments_to_station_code"),
        "track_segments",
        ["to_station_code"],
        unique=False,
    )

    # =========================================================
    # fault_events
    # =========================================================
    op.create_table(
        "fault_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("fault_code", sa.String(length=80), nullable=False),
        sa.Column("track_segment_id", sa.Integer(), nullable=True),
        sa.Column("asset_type", sa.String(length=100), nullable=False),
        sa.Column("fault_type", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "severity",
            sa.Enum(
                "LOW",
                "MEDIUM",
                "HIGH",
                "CRITICAL",
                name="fault_severity",
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "DETECTED",
                "VERIFIED",
                "JOB_CREATED",
                "UNDER_MAINTENANCE",
                "RESOLVED",
                "CLOSED",
                name="fault_status",
            ),
            nullable=False,
        ),
        sa.Column(
            "location",
            geoalchemy2.types.Geometry(
                geometry_type="POINT",
                srid=4326,
                dimension=2,
                spatial_index=False,
                from_text="ST_GeomFromEWKT",
                name="geometry",
            ),
            nullable=True,
        ),
        sa.Column("km_marker", sa.Float(), nullable=True),
        sa.Column("detected_source", sa.String(length=120), nullable=True),
        sa.Column("detection_confidence", sa.Float(), nullable=True),
        sa.Column("safety_critical", sa.Boolean(), nullable=False),
        sa.Column("metadata_json", sa.dialects.postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "detected_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["track_segment_id"],
            ["track_segments.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("fault_code"),
    )

    op.create_index(op.f("ix_fault_events_id"), "fault_events", ["id"], unique=False)
    op.create_index(op.f("ix_fault_events_fault_code"), "fault_events", ["fault_code"], unique=False)
    op.create_index(op.f("ix_fault_events_track_segment_id"), "fault_events", ["track_segment_id"], unique=False)
    op.create_index(op.f("ix_fault_events_asset_type"), "fault_events", ["asset_type"], unique=False)
    op.create_index(op.f("ix_fault_events_fault_type"), "fault_events", ["fault_type"], unique=False)
    op.create_index(op.f("ix_fault_events_severity"), "fault_events", ["severity"], unique=False)
    op.create_index(op.f("ix_fault_events_status"), "fault_events", ["status"], unique=False)
    op.create_index(op.f("ix_fault_events_detected_at"), "fault_events", ["detected_at"], unique=False)

    # =========================================================
    # worker_profiles
    # =========================================================
    op.create_table(
        "worker_profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("employee_code", sa.String(length=50), nullable=False),
        sa.Column("designation", sa.String(length=120), nullable=False),
        sa.Column("department", sa.String(length=120), nullable=True),
        sa.Column("railway_zone", sa.String(length=120), nullable=True),
        sa.Column("division", sa.String(length=120), nullable=True),
        sa.Column("home_station_code", sa.String(length=20), nullable=True),
        sa.Column("home_station_name", sa.String(length=150), nullable=True),
        sa.Column(
            "current_location",
            geoalchemy2.types.Geometry(
                geometry_type="POINT",
                srid=4326,
                dimension=2,
                spatial_index=False,
                from_text="ST_GeomFromEWKT",
                name="geometry",
            ),
            nullable=True,
        ),
        sa.Column("years_experience", sa.Float(), nullable=True),
        sa.Column("max_daily_minutes", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("employee_code"),
        sa.UniqueConstraint("user_id"),
    )

    op.create_index(op.f("ix_worker_profiles_id"), "worker_profiles", ["id"], unique=False)
    op.create_index(op.f("ix_worker_profiles_user_id"), "worker_profiles", ["user_id"], unique=False)
    op.create_index(op.f("ix_worker_profiles_employee_code"), "worker_profiles", ["employee_code"], unique=False)
    op.create_index(op.f("ix_worker_profiles_department"), "worker_profiles", ["department"], unique=False)
    op.create_index(op.f("ix_worker_profiles_railway_zone"), "worker_profiles", ["railway_zone"], unique=False)
    op.create_index(op.f("ix_worker_profiles_division"), "worker_profiles", ["division"], unique=False)

    # =========================================================
    # maintenance_jobs
    # =========================================================
    op.create_table(
        "maintenance_jobs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("job_code", sa.String(length=80), nullable=False),
        sa.Column("fault_id", sa.Integer(), nullable=True),
        sa.Column("track_segment_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("asset_type", sa.String(length=100), nullable=False),
        sa.Column("job_type", sa.String(length=120), nullable=False),
        sa.Column("required_skill", sa.String(length=120), nullable=False),
        sa.Column("required_authority", sa.String(length=120), nullable=True),
        sa.Column(
            "severity",
            sa.Enum(
                "LOW",
                "MEDIUM",
                "HIGH",
                "CRITICAL",
                name="maintenance_job_severity",
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "READY_FOR_ASSIGNMENT",
                "ASSIGNED",
                "IN_PROGRESS",
                "PAUSED",
                "EXTENSION_REQUESTED",
                "COMPLETED",
                "CANCELLED",
                name="maintenance_job_status",
            ),
            nullable=False,
        ),
        sa.Column(
            "location",
            geoalchemy2.types.Geometry(
                geometry_type="POINT",
                srid=4326,
                dimension=2,
                spatial_index=False,
                from_text="ST_GeomFromEWKT",
                name="geometry",
            ),
            nullable=True,
        ),
        sa.Column("km_marker", sa.Float(), nullable=True),
        sa.Column("estimated_minutes", sa.Integer(), nullable=False),
        sa.Column("priority_score", sa.Float(), nullable=True),
        sa.Column("priority_reason", sa.Text(), nullable=True),
        sa.Column("predicted_failure_risk", sa.Float(), nullable=True),
        sa.Column("expected_train_impact", sa.Integer(), nullable=True),
        sa.Column("estimated_delay_minutes", sa.Float(), nullable=True),
        sa.Column("block_required", sa.Boolean(), nullable=False),
        sa.Column("planned_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("planned_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["fault_id"], ["fault_events.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["track_segment_id"], ["track_segments.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("job_code"),
    )

    op.create_index(op.f("ix_maintenance_jobs_id"), "maintenance_jobs", ["id"], unique=False)
    op.create_index(op.f("ix_maintenance_jobs_job_code"), "maintenance_jobs", ["job_code"], unique=False)
    op.create_index(op.f("ix_maintenance_jobs_fault_id"), "maintenance_jobs", ["fault_id"], unique=False)
    op.create_index(op.f("ix_maintenance_jobs_track_segment_id"), "maintenance_jobs", ["track_segment_id"], unique=False)
    op.create_index(op.f("ix_maintenance_jobs_title"), "maintenance_jobs", ["title"], unique=False)
    op.create_index(op.f("ix_maintenance_jobs_asset_type"), "maintenance_jobs", ["asset_type"], unique=False)
    op.create_index(op.f("ix_maintenance_jobs_job_type"), "maintenance_jobs", ["job_type"], unique=False)
    op.create_index(op.f("ix_maintenance_jobs_required_skill"), "maintenance_jobs", ["required_skill"], unique=False)
    op.create_index(op.f("ix_maintenance_jobs_required_authority"), "maintenance_jobs", ["required_authority"], unique=False)
    op.create_index(op.f("ix_maintenance_jobs_severity"), "maintenance_jobs", ["severity"], unique=False)
    op.create_index(op.f("ix_maintenance_jobs_status"), "maintenance_jobs", ["status"], unique=False)
    op.create_index(op.f("ix_maintenance_jobs_priority_score"), "maintenance_jobs", ["priority_score"], unique=False)
    op.create_index(op.f("ix_maintenance_jobs_created_by_user_id"), "maintenance_jobs", ["created_by_user_id"], unique=False)
    op.create_index(op.f("ix_maintenance_jobs_created_at"), "maintenance_jobs", ["created_at"], unique=False)

    # =========================================================
    # worker_skills
    # =========================================================
    op.create_table(
        "worker_skills",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("worker_id", sa.Integer(), nullable=False),
        sa.Column("skill_code", sa.String(length=100), nullable=False),
        sa.Column("skill_name", sa.String(length=150), nullable=False),
        sa.Column("authority_code", sa.String(length=100), nullable=True),
        sa.Column("proficiency_level", sa.Integer(), nullable=False),
        sa.Column("certification_expiry", sa.Date(), nullable=True),
        sa.Column("is_certified", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["worker_id"], ["worker_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(op.f("ix_worker_skills_id"), "worker_skills", ["id"], unique=False)
    op.create_index(op.f("ix_worker_skills_worker_id"), "worker_skills", ["worker_id"], unique=False)
    op.create_index(op.f("ix_worker_skills_skill_code"), "worker_skills", ["skill_code"], unique=False)
    op.create_index(op.f("ix_worker_skills_authority_code"), "worker_skills", ["authority_code"], unique=False)

    # =========================================================
    # worker_availability
    # =========================================================
    op.create_table(
        "worker_availability",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("worker_id", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "AVAILABLE",
                "PARTIAL",
                "UNAVAILABLE",
                name="worker_availability_status",
            ),
            nullable=False,
        ),
        sa.Column("available_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("available_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["worker_id"], ["worker_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(op.f("ix_worker_availability_id"), "worker_availability", ["id"], unique=False)
    op.create_index(op.f("ix_worker_availability_worker_id"), "worker_availability", ["worker_id"], unique=False)
    op.create_index(op.f("ix_worker_availability_status"), "worker_availability", ["status"], unique=False)

    # =========================================================
    # worker_attendance
    # =========================================================
    op.create_table(
        "worker_attendance",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("worker_id", sa.Integer(), nullable=False),
        sa.Column("attendance_date", sa.Date(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "PRESENT",
                "ABSENT",
                "LEAVE",
                "PARTIAL",
                name="worker_attendance_status",
            ),
            nullable=False,
        ),
        sa.Column("shift_start", sa.Time(), nullable=True),
        sa.Column("shift_end", sa.Time(), nullable=True),
        sa.Column("checked_in_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("checked_out_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["worker_id"], ["worker_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(op.f("ix_worker_attendance_id"), "worker_attendance", ["id"], unique=False)
    op.create_index(op.f("ix_worker_attendance_worker_id"), "worker_attendance", ["worker_id"], unique=False)
    op.create_index(op.f("ix_worker_attendance_attendance_date"), "worker_attendance", ["attendance_date"], unique=False)

    # =========================================================
    # worker_assignments
    # =========================================================
    op.create_table(
        "worker_assignments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("maintenance_job_id", sa.Integer(), nullable=False),
        sa.Column("worker_id", sa.Integer(), nullable=False),
        sa.Column("assigned_by_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "ASSIGNED",
                "ACCEPTED",
                "IN_PROGRESS",
                "PAUSED",
                "COMPLETED",
                "CANCELLED",
                name="worker_assignment_status",
            ),
            nullable=False,
        ),
        sa.Column("suitability_score", sa.Float(), nullable=True),
        sa.Column("suitability_reason", sa.Text(), nullable=True),
        sa.Column(
            "assigned_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paused_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("progress_percent", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["assigned_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["maintenance_job_id"], ["maintenance_jobs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["worker_id"], ["worker_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(op.f("ix_worker_assignments_id"), "worker_assignments", ["id"], unique=False)
    op.create_index(op.f("ix_worker_assignments_maintenance_job_id"), "worker_assignments", ["maintenance_job_id"], unique=False)
    op.create_index(op.f("ix_worker_assignments_worker_id"), "worker_assignments", ["worker_id"], unique=False)
    op.create_index(op.f("ix_worker_assignments_assigned_by_user_id"), "worker_assignments", ["assigned_by_user_id"], unique=False)
    op.create_index(op.f("ix_worker_assignments_status"), "worker_assignments", ["status"], unique=False)

    # =========================================================
    # work_logs
    # =========================================================
    op.create_table(
        "work_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("maintenance_job_id", sa.Integer(), nullable=False),
        sa.Column("assignment_id", sa.Integer(), nullable=True),
        sa.Column("worker_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("progress_percent", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["assignment_id"], ["worker_assignments.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["maintenance_job_id"], ["maintenance_jobs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["worker_id"], ["worker_profiles.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(op.f("ix_work_logs_id"), "work_logs", ["id"], unique=False)
    op.create_index(op.f("ix_work_logs_maintenance_job_id"), "work_logs", ["maintenance_job_id"], unique=False)
    op.create_index(op.f("ix_work_logs_assignment_id"), "work_logs", ["assignment_id"], unique=False)
    op.create_index(op.f("ix_work_logs_worker_id"), "work_logs", ["worker_id"], unique=False)
    op.create_index(op.f("ix_work_logs_action"), "work_logs", ["action"], unique=False)
    op.create_index(op.f("ix_work_logs_created_at"), "work_logs", ["created_at"], unique=False)

    # =========================================================
    # extension_requests
    # =========================================================
    op.create_table(
        "extension_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("maintenance_job_id", sa.Integer(), nullable=False),
        sa.Column("assignment_id", sa.Integer(), nullable=False),
        sa.Column("worker_id", sa.Integer(), nullable=False),
        sa.Column("requested_minutes", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "APPROVED",
                "REJECTED",
                name="extension_request_status",
            ),
            nullable=False,
        ),
        sa.Column(
            "requested_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("reviewed_by_user_id", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("manager_note", sa.Text(), nullable=True),
        sa.Column("approved_new_end", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["assignment_id"], ["worker_assignments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["maintenance_job_id"], ["maintenance_jobs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewed_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["worker_id"], ["worker_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(op.f("ix_extension_requests_id"), "extension_requests", ["id"], unique=False)
    op.create_index(op.f("ix_extension_requests_maintenance_job_id"), "extension_requests", ["maintenance_job_id"], unique=False)
    op.create_index(op.f("ix_extension_requests_assignment_id"), "extension_requests", ["assignment_id"], unique=False)
    op.create_index(op.f("ix_extension_requests_worker_id"), "extension_requests", ["worker_id"], unique=False)
    op.create_index(op.f("ix_extension_requests_status"), "extension_requests", ["status"], unique=False)
    op.create_index(op.f("ix_extension_requests_reviewed_by_user_id"), "extension_requests", ["reviewed_by_user_id"], unique=False)

    # =========================================================
    # disruption_events
    # =========================================================
    op.create_table(
        "disruption_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("disruption_code", sa.String(length=80), nullable=False),
        sa.Column("maintenance_job_id", sa.Integer(), nullable=True),
        sa.Column("track_segment_id", sa.Integer(), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "OPEN",
                "EVALUATING",
                "ACTION_SELECTED",
                "RESOLVED",
                name="disruption_status",
            ),
            nullable=False,
        ),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("expected_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expected_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("estimated_delay_minutes", sa.Float(), nullable=True),
        sa.Column(
            "severity",
            sa.Enum(
                "LOW",
                "MEDIUM",
                "HIGH",
                "CRITICAL",
                name="disruption_severity",
            ),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["maintenance_job_id"], ["maintenance_jobs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["track_segment_id"], ["track_segments.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("disruption_code"),
    )

    op.create_index(op.f("ix_disruption_events_id"), "disruption_events", ["id"], unique=False)
    op.create_index(op.f("ix_disruption_events_disruption_code"), "disruption_events", ["disruption_code"], unique=False)
    op.create_index(op.f("ix_disruption_events_maintenance_job_id"), "disruption_events", ["maintenance_job_id"], unique=False)
    op.create_index(op.f("ix_disruption_events_track_segment_id"), "disruption_events", ["track_segment_id"], unique=False)
    op.create_index(op.f("ix_disruption_events_status"), "disruption_events", ["status"], unique=False)
    op.create_index(op.f("ix_disruption_events_created_at"), "disruption_events", ["created_at"], unique=False)

    # =========================================================
    # affected_trains
    # =========================================================
    op.create_table(
        "affected_trains",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("disruption_id", sa.Integer(), nullable=False),
        sa.Column("train_id", sa.Integer(), nullable=True),
        sa.Column("train_number", sa.String(length=30), nullable=False),
        sa.Column("train_name", sa.String(length=200), nullable=True),
        sa.Column("scheduled_passage", sa.DateTime(timezone=True), nullable=True),
        sa.Column("predicted_delay_minutes", sa.Float(), nullable=True),
        sa.Column("priority_class", sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(["disruption_id"], ["disruption_events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["train_id"], ["trains.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(op.f("ix_affected_trains_id"), "affected_trains", ["id"], unique=False)
    op.create_index(op.f("ix_affected_trains_disruption_id"), "affected_trains", ["disruption_id"], unique=False)
    op.create_index(op.f("ix_affected_trains_train_id"), "affected_trains", ["train_id"], unique=False)
    op.create_index(op.f("ix_affected_trains_train_number"), "affected_trains", ["train_number"], unique=False)

    # =========================================================
    # route_alternatives
    # =========================================================
    op.create_table(
        "route_alternatives",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("disruption_id", sa.Integer(), nullable=False),
        sa.Column("alternative_code", sa.String(length=80), nullable=False),
        sa.Column("action_type", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "route_geometry",
            geoalchemy2.types.Geometry(
                geometry_type="LINESTRING",
                srid=4326,
                dimension=2,
                spatial_index=False,
                from_text="ST_GeomFromEWKT",
                name="geometry",
            ),
            nullable=True,
        ),
        sa.Column("predicted_delay_minutes", sa.Float(), nullable=True),
        sa.Column("predicted_cost", sa.Float(), nullable=True),
        sa.Column("conflict_count", sa.Integer(), nullable=False),
        sa.Column("feasibility_score", sa.Float(), nullable=True),
        sa.Column("ml_rank_score", sa.Float(), nullable=True),
        sa.Column("is_feasible", sa.Boolean(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "GENERATED",
                "RECOMMENDED",
                "SELECTED",
                "REJECTED",
                name="route_alternative_status",
            ),
            nullable=False,
        ),
        sa.Column("generated_reason", sa.Text(), nullable=True),
        sa.Column("selected_by_user_id", sa.Integer(), nullable=True),
        sa.Column("selected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["disruption_id"], ["disruption_events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["selected_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(op.f("ix_route_alternatives_id"), "route_alternatives", ["id"], unique=False)
    op.create_index(op.f("ix_route_alternatives_disruption_id"), "route_alternatives", ["disruption_id"], unique=False)
    op.create_index(op.f("ix_route_alternatives_alternative_code"), "route_alternatives", ["alternative_code"], unique=False)
    op.create_index(op.f("ix_route_alternatives_action_type"), "route_alternatives", ["action_type"], unique=False)
    op.create_index(op.f("ix_route_alternatives_status"), "route_alternatives", ["status"], unique=False)


def downgrade() -> None:
    # Drop child tables first.
    op.drop_index(op.f("ix_route_alternatives_status"), table_name="route_alternatives")
    op.drop_index(op.f("ix_route_alternatives_action_type"), table_name="route_alternatives")
    op.drop_index(op.f("ix_route_alternatives_alternative_code"), table_name="route_alternatives")
    op.drop_index(op.f("ix_route_alternatives_disruption_id"), table_name="route_alternatives")
    op.drop_index(op.f("ix_route_alternatives_id"), table_name="route_alternatives")
    op.drop_table("route_alternatives")

    op.drop_index(op.f("ix_affected_trains_train_number"), table_name="affected_trains")
    op.drop_index(op.f("ix_affected_trains_train_id"), table_name="affected_trains")
    op.drop_index(op.f("ix_affected_trains_disruption_id"), table_name="affected_trains")
    op.drop_index(op.f("ix_affected_trains_id"), table_name="affected_trains")
    op.drop_table("affected_trains")

    op.drop_index(op.f("ix_disruption_events_created_at"), table_name="disruption_events")
    op.drop_index(op.f("ix_disruption_events_status"), table_name="disruption_events")
    op.drop_index(op.f("ix_disruption_events_track_segment_id"), table_name="disruption_events")
    op.drop_index(op.f("ix_disruption_events_maintenance_job_id"), table_name="disruption_events")
    op.drop_index(op.f("ix_disruption_events_disruption_code"), table_name="disruption_events")
    op.drop_index(op.f("ix_disruption_events_id"), table_name="disruption_events")
    op.drop_table("disruption_events")

    op.drop_index(op.f("ix_extension_requests_reviewed_by_user_id"), table_name="extension_requests")
    op.drop_index(op.f("ix_extension_requests_status"), table_name="extension_requests")
    op.drop_index(op.f("ix_extension_requests_worker_id"), table_name="extension_requests")
    op.drop_index(op.f("ix_extension_requests_assignment_id"), table_name="extension_requests")
    op.drop_index(op.f("ix_extension_requests_maintenance_job_id"), table_name="extension_requests")
    op.drop_index(op.f("ix_extension_requests_id"), table_name="extension_requests")
    op.drop_table("extension_requests")

    op.drop_index(op.f("ix_work_logs_created_at"), table_name="work_logs")
    op.drop_index(op.f("ix_work_logs_action"), table_name="work_logs")
    op.drop_index(op.f("ix_work_logs_worker_id"), table_name="work_logs")
    op.drop_index(op.f("ix_work_logs_assignment_id"), table_name="work_logs")
    op.drop_index(op.f("ix_work_logs_maintenance_job_id"), table_name="work_logs")
    op.drop_index(op.f("ix_work_logs_id"), table_name="work_logs")
    op.drop_table("work_logs")

    op.drop_index(op.f("ix_worker_assignments_status"), table_name="worker_assignments")
    op.drop_index(op.f("ix_worker_assignments_assigned_by_user_id"), table_name="worker_assignments")
    op.drop_index(op.f("ix_worker_assignments_worker_id"), table_name="worker_assignments")
    op.drop_index(op.f("ix_worker_assignments_maintenance_job_id"), table_name="worker_assignments")
    op.drop_index(op.f("ix_worker_assignments_id"), table_name="worker_assignments")
    op.drop_table("worker_assignments")

    op.drop_index(op.f("ix_worker_attendance_attendance_date"), table_name="worker_attendance")
    op.drop_index(op.f("ix_worker_attendance_worker_id"), table_name="worker_attendance")
    op.drop_index(op.f("ix_worker_attendance_id"), table_name="worker_attendance")
    op.drop_table("worker_attendance")

    op.drop_index(op.f("ix_worker_availability_status"), table_name="worker_availability")
    op.drop_index(op.f("ix_worker_availability_worker_id"), table_name="worker_availability")
    op.drop_index(op.f("ix_worker_availability_id"), table_name="worker_availability")
    op.drop_table("worker_availability")

    op.drop_index(op.f("ix_worker_skills_authority_code"), table_name="worker_skills")
    op.drop_index(op.f("ix_worker_skills_skill_code"), table_name="worker_skills")
    op.drop_index(op.f("ix_worker_skills_worker_id"), table_name="worker_skills")
    op.drop_index(op.f("ix_worker_skills_id"), table_name="worker_skills")
    op.drop_table("worker_skills")

    op.drop_index(op.f("ix_maintenance_jobs_created_at"), table_name="maintenance_jobs")
    op.drop_index(op.f("ix_maintenance_jobs_created_by_user_id"), table_name="maintenance_jobs")
    op.drop_index(op.f("ix_maintenance_jobs_priority_score"), table_name="maintenance_jobs")
    op.drop_index(op.f("ix_maintenance_jobs_status"), table_name="maintenance_jobs")
    op.drop_index(op.f("ix_maintenance_jobs_severity"), table_name="maintenance_jobs")
    op.drop_index(op.f("ix_maintenance_jobs_required_authority"), table_name="maintenance_jobs")
    op.drop_index(op.f("ix_maintenance_jobs_required_skill"), table_name="maintenance_jobs")
    op.drop_index(op.f("ix_maintenance_jobs_job_type"), table_name="maintenance_jobs")
    op.drop_index(op.f("ix_maintenance_jobs_asset_type"), table_name="maintenance_jobs")
    op.drop_index(op.f("ix_maintenance_jobs_title"), table_name="maintenance_jobs")
    op.drop_index(op.f("ix_maintenance_jobs_track_segment_id"), table_name="maintenance_jobs")
    op.drop_index(op.f("ix_maintenance_jobs_fault_id"), table_name="maintenance_jobs")
    op.drop_index(op.f("ix_maintenance_jobs_job_code"), table_name="maintenance_jobs")
    op.drop_index(op.f("ix_maintenance_jobs_id"), table_name="maintenance_jobs")
    op.drop_table("maintenance_jobs")

    op.drop_index(op.f("ix_worker_profiles_division"), table_name="worker_profiles")
    op.drop_index(op.f("ix_worker_profiles_railway_zone"), table_name="worker_profiles")
    op.drop_index(op.f("ix_worker_profiles_department"), table_name="worker_profiles")
    op.drop_index(op.f("ix_worker_profiles_employee_code"), table_name="worker_profiles")
    op.drop_index(op.f("ix_worker_profiles_user_id"), table_name="worker_profiles")
    op.drop_index(op.f("ix_worker_profiles_id"), table_name="worker_profiles")
    op.drop_table("worker_profiles")

    op.drop_index(op.f("ix_fault_events_detected_at"), table_name="fault_events")
    op.drop_index(op.f("ix_fault_events_status"), table_name="fault_events")
    op.drop_index(op.f("ix_fault_events_severity"), table_name="fault_events")
    op.drop_index(op.f("ix_fault_events_fault_type"), table_name="fault_events")
    op.drop_index(op.f("ix_fault_events_asset_type"), table_name="fault_events")
    op.drop_index(op.f("ix_fault_events_track_segment_id"), table_name="fault_events")
    op.drop_index(op.f("ix_fault_events_fault_code"), table_name="fault_events")
    op.drop_index(op.f("ix_fault_events_id"), table_name="fault_events")
    op.drop_table("fault_events")

    op.drop_index(op.f("ix_track_segments_to_station_code"), table_name="track_segments")
    op.drop_index(op.f("ix_track_segments_from_station_code"), table_name="track_segments")
    op.drop_index(op.f("ix_track_segments_segment_code"), table_name="track_segments")
    op.drop_index(op.f("ix_track_segments_corridor_id"), table_name="track_segments")
    op.drop_index(op.f("ix_track_segments_id"), table_name="track_segments")
    op.drop_table("track_segments")

    op.drop_index(op.f("ix_railway_corridors_end_station_code"), table_name="railway_corridors")
    op.drop_index(op.f("ix_railway_corridors_start_station_code"), table_name="railway_corridors")
    op.drop_index(op.f("ix_railway_corridors_division"), table_name="railway_corridors")
    op.drop_index(op.f("ix_railway_corridors_zone"), table_name="railway_corridors")
    op.drop_index(op.f("ix_railway_corridors_name"), table_name="railway_corridors")
    op.drop_index(op.f("ix_railway_corridors_corridor_code"), table_name="railway_corridors")
    op.drop_index(op.f("ix_railway_corridors_id"), table_name="railway_corridors")
    op.drop_table("railway_corridors")

    # Explicitly drop PostgreSQL enum types created by this migration.
    bind = op.get_bind()

    for enum_name in [
        "route_alternative_status",
        "disruption_severity",
        "disruption_status",
        "extension_request_status",
        "worker_assignment_status",
        "worker_attendance_status",
        "worker_availability_status",
        "maintenance_job_status",
        "maintenance_job_severity",
        "fault_status",
        "fault_severity",
    ]:
        sa.Enum(name=enum_name).drop(bind, checkfirst=True)
