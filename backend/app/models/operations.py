import enum

from geoalchemy2 import Geometry
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


# =========================================================
# ENUMS
# =========================================================


class FaultSeverity(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class FaultStatus(str, enum.Enum):
    DETECTED = "DETECTED"
    VERIFIED = "VERIFIED"
    JOB_CREATED = "JOB_CREATED"
    UNDER_MAINTENANCE = "UNDER_MAINTENANCE"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class JobStatus(str, enum.Enum):
    PENDING = "PENDING"
    READY_FOR_ASSIGNMENT = "READY_FOR_ASSIGNMENT"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    PAUSED = "PAUSED"
    EXTENSION_REQUESTED = "EXTENSION_REQUESTED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class WorkerAvailabilityStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    PARTIAL = "PARTIAL"
    UNAVAILABLE = "UNAVAILABLE"


class AttendanceStatus(str, enum.Enum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    LEAVE = "LEAVE"
    PARTIAL = "PARTIAL"


class AssignmentStatus(str, enum.Enum):
    ASSIGNED = "ASSIGNED"
    ACCEPTED = "ACCEPTED"
    IN_PROGRESS = "IN_PROGRESS"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ExtensionStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class DisruptionStatus(str, enum.Enum):
    OPEN = "OPEN"
    EVALUATING = "EVALUATING"
    ACTION_SELECTED = "ACTION_SELECTED"
    RESOLVED = "RESOLVED"


class AlternativeStatus(str, enum.Enum):
    GENERATED = "GENERATED"
    RECOMMENDED = "RECOMMENDED"
    SELECTED = "SELECTED"
    REJECTED = "REJECTED"


# =========================================================
# RAILWAY CORRIDORS
# =========================================================


class RailwayCorridor(Base):
    __tablename__ = "railway_corridors"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    corridor_code = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )

    name = Column(
        String(200),
        nullable=False,
        index=True,
    )

    zone = Column(
        String(120),
        nullable=True,
        index=True,
    )

    division = Column(
        String(120),
        nullable=True,
        index=True,
    )

    start_station_code = Column(
        String(20),
        nullable=True,
        index=True,
    )

    start_station_name = Column(
        String(150),
        nullable=True,
    )

    end_station_code = Column(
        String(20),
        nullable=True,
        index=True,
    )

    end_station_name = Column(
        String(150),
        nullable=True,
    )

    state_from = Column(
        String(100),
        nullable=True,
    )

    state_to = Column(
        String(100),
        nullable=True,
    )

    total_length_km = Column(
        Float,
        nullable=True,
    )

    geometry = Column(
        Geometry(
            geometry_type="LINESTRING",
            srid=4326,
        ),
        nullable=True,
    )

    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    track_segments = relationship(
        "TrackSegment",
        back_populates="corridor",
        cascade="all, delete-orphan",
    )


# =========================================================
# TRACK SEGMENTS
# =========================================================


class TrackSegment(Base):
    __tablename__ = "track_segments"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    corridor_id = Column(
        Integer,
        ForeignKey(
            "railway_corridors.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    segment_code = Column(
        String(80),
        unique=True,
        nullable=False,
        index=True,
    )

    name = Column(
        String(200),
        nullable=False,
    )

    from_station_code = Column(
        String(20),
        nullable=True,
        index=True,
    )

    from_station_name = Column(
        String(150),
        nullable=True,
    )

    to_station_code = Column(
        String(20),
        nullable=True,
        index=True,
    )

    to_station_name = Column(
        String(150),
        nullable=True,
    )

    line_name = Column(
        String(100),
        nullable=True,
    )

    track_number = Column(
        String(40),
        nullable=True,
    )

    direction = Column(
        String(30),
        nullable=True,
    )

    electrified = Column(
        Boolean,
        nullable=True,
    )

    max_speed_kmph = Column(
        Float,
        nullable=True,
    )

    length_km = Column(
        Float,
        nullable=True,
    )

    geometry = Column(
        Geometry(
            geometry_type="LINESTRING",
            srid=4326,
        ),
        nullable=True,
    )

    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    corridor = relationship(
        "RailwayCorridor",
        back_populates="track_segments",
    )

    faults = relationship(
        "FaultEvent",
        back_populates="track_segment",
    )

    maintenance_jobs = relationship(
        "MaintenanceJob",
        back_populates="track_segment",
    )


# =========================================================
# FAULT EVENTS
# =========================================================


class FaultEvent(Base):
    __tablename__ = "fault_events"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    fault_code = Column(
        String(80),
        unique=True,
        nullable=False,
        index=True,
    )

    track_segment_id = Column(
        Integer,
        ForeignKey(
            "track_segments.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    asset_type = Column(
        String(100),
        nullable=False,
        index=True,
    )

    fault_type = Column(
        String(150),
        nullable=False,
        index=True,
    )

    description = Column(
        Text,
        nullable=True,
    )

    severity = Column(
        Enum(
            FaultSeverity,
            name="fault_severity",
        ),
        nullable=False,
        default=FaultSeverity.MEDIUM,
        index=True,
    )

    status = Column(
        Enum(
            FaultStatus,
            name="fault_status",
        ),
        nullable=False,
        default=FaultStatus.DETECTED,
        index=True,
    )

    location = Column(
        Geometry(
            geometry_type="POINT",
            srid=4326,
        ),
        nullable=True,
    )

    km_marker = Column(
        Float,
        nullable=True,
    )

    detected_source = Column(
        String(120),
        nullable=True,
    )

    detection_confidence = Column(
        Float,
        nullable=True,
    )

    safety_critical = Column(
        Boolean,
        default=False,
        nullable=False,
    )

    metadata_json = Column(
        JSONB,
        nullable=True,
    )

    detected_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    verified_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    resolved_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    track_segment = relationship(
        "TrackSegment",
        back_populates="faults",
    )

    maintenance_jobs = relationship(
        "MaintenanceJob",
        back_populates="fault",
    )


# =========================================================
# MAINTENANCE JOBS
# =========================================================


class MaintenanceJob(Base):
    __tablename__ = "maintenance_jobs"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    job_code = Column(
        String(80),
        unique=True,
        nullable=False,
        index=True,
    )

    fault_id = Column(
        Integer,
        ForeignKey(
            "fault_events.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    track_segment_id = Column(
        Integer,
        ForeignKey(
            "track_segments.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    title = Column(
        String(200),
        nullable=False,
        index=True,
    )

    description = Column(
        Text,
        nullable=True,
    )

    asset_type = Column(
        String(100),
        nullable=False,
        index=True,
    )

    job_type = Column(
        String(120),
        nullable=False,
        index=True,
    )

    required_skill = Column(
        String(120),
        nullable=False,
        index=True,
    )

    required_authority = Column(
        String(120),
        nullable=True,
        index=True,
    )

    severity = Column(
        Enum(
            FaultSeverity,
            name="maintenance_job_severity",
        ),
        nullable=False,
        default=FaultSeverity.MEDIUM,
        index=True,
    )

    status = Column(
        Enum(
            JobStatus,
            name="maintenance_job_status",
        ),
        nullable=False,
        default=JobStatus.PENDING,
        index=True,
    )

    location = Column(
        Geometry(
            geometry_type="POINT",
            srid=4326,
        ),
        nullable=True,
    )

    km_marker = Column(
        Float,
        nullable=True,
    )

    estimated_minutes = Column(
        Integer,
        nullable=False,
        default=60,
    )

    priority_score = Column(
        Float,
        nullable=True,
        index=True,
    )

    priority_reason = Column(
        Text,
        nullable=True,
    )

    predicted_failure_risk = Column(
        Float,
        nullable=True,
    )

    expected_train_impact = Column(
        Integer,
        nullable=True,
    )

    estimated_delay_minutes = Column(
        Float,
        nullable=True,
    )

    block_required = Column(
        Boolean,
        default=True,
        nullable=False,
    )

    planned_start = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    planned_end = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    actual_start = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    actual_end = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_by_user_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    fault = relationship(
        "FaultEvent",
        back_populates="maintenance_jobs",
    )

    track_segment = relationship(
        "TrackSegment",
        back_populates="maintenance_jobs",
    )

    assignments = relationship(
        "WorkerAssignment",
        back_populates="maintenance_job",
    )

    extension_requests = relationship(
        "ExtensionRequest",
        back_populates="maintenance_job",
    )

    work_logs = relationship(
        "WorkLog",
        back_populates="maintenance_job",
    )

    disruption_events = relationship(
        "DisruptionEvent",
        back_populates="maintenance_job",
    )


# =========================================================
# WORKER PROFILE
# =========================================================


class WorkerProfile(Base):
    __tablename__ = "worker_profiles"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        unique=True,
        nullable=False,
        index=True,
    )

    employee_code = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )

    designation = Column(
        String(120),
        nullable=False,
    )

    department = Column(
        String(120),
        nullable=True,
        index=True,
    )

    railway_zone = Column(
        String(120),
        nullable=True,
        index=True,
    )

    division = Column(
        String(120),
        nullable=True,
        index=True,
    )

    home_station_code = Column(
        String(20),
        nullable=True,
    )

    home_station_name = Column(
        String(150),
        nullable=True,
    )

    current_location = Column(
        Geometry(
            geometry_type="POINT",
            srid=4326,
        ),
        nullable=True,
    )

    years_experience = Column(
        Float,
        nullable=True,
    )

    max_daily_minutes = Column(
        Integer,
        default=360,
        nullable=False,
    )

    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    skills = relationship(
        "WorkerSkill",
        back_populates="worker",
        cascade="all, delete-orphan",
    )

    availability_records = relationship(
        "WorkerAvailability",
        back_populates="worker",
        cascade="all, delete-orphan",
    )

    attendance_records = relationship(
        "WorkerAttendance",
        back_populates="worker",
        cascade="all, delete-orphan",
    )

    assignments = relationship(
        "WorkerAssignment",
        back_populates="worker",
    )


# =========================================================
# WORKER SKILLS
# =========================================================


class WorkerSkill(Base):
    __tablename__ = "worker_skills"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    worker_id = Column(
        Integer,
        ForeignKey(
            "worker_profiles.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    skill_code = Column(
        String(100),
        nullable=False,
        index=True,
    )

    skill_name = Column(
        String(150),
        nullable=False,
    )

    authority_code = Column(
        String(100),
        nullable=True,
        index=True,
    )

    proficiency_level = Column(
        Integer,
        default=1,
        nullable=False,
    )

    certification_expiry = Column(
        Date,
        nullable=True,
    )

    is_certified = Column(
        Boolean,
        default=True,
        nullable=False,
    )

    worker = relationship(
        "WorkerProfile",
        back_populates="skills",
    )


# =========================================================
# WORKER AVAILABILITY
# =========================================================


class WorkerAvailability(Base):
    __tablename__ = "worker_availability"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    worker_id = Column(
        Integer,
        ForeignKey(
            "worker_profiles.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    status = Column(
        Enum(
            WorkerAvailabilityStatus,
            name="worker_availability_status",
        ),
        nullable=False,
        default=WorkerAvailabilityStatus.AVAILABLE,
        index=True,
    )

    available_from = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    available_until = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    reason = Column(
        String(255),
        nullable=True,
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    worker = relationship(
        "WorkerProfile",
        back_populates="availability_records",
    )


# =========================================================
# WORKER ATTENDANCE
# =========================================================


class WorkerAttendance(Base):
    __tablename__ = "worker_attendance"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    worker_id = Column(
        Integer,
        ForeignKey(
            "worker_profiles.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    attendance_date = Column(
        Date,
        nullable=False,
        index=True,
    )

    status = Column(
        Enum(
            AttendanceStatus,
            name="worker_attendance_status",
        ),
        nullable=False,
        default=AttendanceStatus.PRESENT,
    )

    shift_start = Column(
        Time,
        nullable=True,
    )

    shift_end = Column(
        Time,
        nullable=True,
    )

    checked_in_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    checked_out_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    worker = relationship(
        "WorkerProfile",
        back_populates="attendance_records",
    )


# =========================================================
# WORKER ASSIGNMENTS
# =========================================================


class WorkerAssignment(Base):
    __tablename__ = "worker_assignments"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    maintenance_job_id = Column(
        Integer,
        ForeignKey(
            "maintenance_jobs.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    worker_id = Column(
        Integer,
        ForeignKey(
            "worker_profiles.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    assigned_by_user_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    status = Column(
        Enum(
            AssignmentStatus,
            name="worker_assignment_status",
        ),
        nullable=False,
        default=AssignmentStatus.ASSIGNED,
        index=True,
    )

    suitability_score = Column(
        Float,
        nullable=True,
    )

    suitability_reason = Column(
        Text,
        nullable=True,
    )

    assigned_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    accepted_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    started_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    paused_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    completed_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    progress_percent = Column(
        Integer,
        default=0,
        nullable=False,
    )

    maintenance_job = relationship(
        "MaintenanceJob",
        back_populates="assignments",
    )

    worker = relationship(
        "WorkerProfile",
        back_populates="assignments",
    )

    work_logs = relationship(
        "WorkLog",
        back_populates="assignment",
    )


# =========================================================
# WORK LOG
# =========================================================


class WorkLog(Base):
    __tablename__ = "work_logs"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    maintenance_job_id = Column(
        Integer,
        ForeignKey(
            "maintenance_jobs.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    assignment_id = Column(
        Integer,
        ForeignKey(
            "worker_assignments.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    worker_id = Column(
        Integer,
        ForeignKey(
            "worker_profiles.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    action = Column(
        String(100),
        nullable=False,
        index=True,
    )

    message = Column(
        Text,
        nullable=True,
    )

    progress_percent = Column(
        Integer,
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    maintenance_job = relationship(
        "MaintenanceJob",
        back_populates="work_logs",
    )

    assignment = relationship(
        "WorkerAssignment",
        back_populates="work_logs",
    )


# =========================================================
# EXTENSION REQUEST
# =========================================================


class ExtensionRequest(Base):
    __tablename__ = "extension_requests"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    maintenance_job_id = Column(
        Integer,
        ForeignKey(
            "maintenance_jobs.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    assignment_id = Column(
        Integer,
        ForeignKey(
            "worker_assignments.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    worker_id = Column(
        Integer,
        ForeignKey(
            "worker_profiles.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    requested_minutes = Column(
        Integer,
        nullable=False,
    )

    reason = Column(
        Text,
        nullable=False,
    )

    status = Column(
        Enum(
            ExtensionStatus,
            name="extension_request_status",
        ),
        nullable=False,
        default=ExtensionStatus.PENDING,
        index=True,
    )

    requested_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    reviewed_by_user_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    reviewed_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    manager_note = Column(
        Text,
        nullable=True,
    )

    approved_new_end = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    maintenance_job = relationship(
        "MaintenanceJob",
        back_populates="extension_requests",
    )


# =========================================================
# TRAIN DISRUPTION EVENTS
# =========================================================


class DisruptionEvent(Base):
    __tablename__ = "disruption_events"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    disruption_code = Column(
        String(80),
        unique=True,
        nullable=False,
        index=True,
    )

    maintenance_job_id = Column(
        Integer,
        ForeignKey(
            "maintenance_jobs.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    track_segment_id = Column(
        Integer,
        ForeignKey(
            "track_segments.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    status = Column(
        Enum(
            DisruptionStatus,
            name="disruption_status",
        ),
        nullable=False,
        default=DisruptionStatus.OPEN,
        index=True,
    )

    reason = Column(
        Text,
        nullable=False,
    )

    expected_start = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    expected_end = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    estimated_delay_minutes = Column(
        Float,
        nullable=True,
    )

    severity = Column(
        Enum(
            FaultSeverity,
            name="disruption_severity",
        ),
        nullable=False,
        default=FaultSeverity.MEDIUM,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    resolved_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    maintenance_job = relationship(
        "MaintenanceJob",
        back_populates="disruption_events",
    )

    affected_trains = relationship(
        "AffectedTrain",
        back_populates="disruption",
        cascade="all, delete-orphan",
    )

    alternatives = relationship(
        "RouteAlternative",
        back_populates="disruption",
        cascade="all, delete-orphan",
    )


# =========================================================
# AFFECTED TRAINS
# =========================================================


class AffectedTrain(Base):
    __tablename__ = "affected_trains"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    disruption_id = Column(
        Integer,
        ForeignKey(
            "disruption_events.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    train_id = Column(
        Integer,
        ForeignKey(
            "trains.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    train_number = Column(
        String(30),
        nullable=False,
        index=True,
    )

    train_name = Column(
        String(200),
        nullable=True,
    )

    scheduled_passage = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    predicted_delay_minutes = Column(
        Float,
        nullable=True,
    )

    priority_class = Column(
        String(50),
        nullable=True,
    )

    disruption = relationship(
        "DisruptionEvent",
        back_populates="affected_trains",
    )


# =========================================================
# ROUTE / OPERATION ALTERNATIVES
# =========================================================


class RouteAlternative(Base):
    __tablename__ = "route_alternatives"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    disruption_id = Column(
        Integer,
        ForeignKey(
            "disruption_events.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    alternative_code = Column(
        String(80),
        nullable=False,
        index=True,
    )

    action_type = Column(
        String(100),
        nullable=False,
        index=True,
    )

    title = Column(
        String(200),
        nullable=False,
    )

    description = Column(
        Text,
        nullable=True,
    )

    route_geometry = Column(
        Geometry(
            geometry_type="LINESTRING",
            srid=4326,
        ),
        nullable=True,
    )

    predicted_delay_minutes = Column(
        Float,
        nullable=True,
    )

    predicted_cost = Column(
        Float,
        nullable=True,
    )

    conflict_count = Column(
        Integer,
        default=0,
        nullable=False,
    )

    feasibility_score = Column(
        Float,
        nullable=True,
    )

    ml_rank_score = Column(
        Float,
        nullable=True,
    )

    is_feasible = Column(
        Boolean,
        default=True,
        nullable=False,
    )

    status = Column(
        Enum(
            AlternativeStatus,
            name="route_alternative_status",
        ),
        nullable=False,
        default=AlternativeStatus.GENERATED,
        index=True,
    )

    generated_reason = Column(
        Text,
        nullable=True,
    )

    selected_by_user_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    selected_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    disruption = relationship(
        "DisruptionEvent",
        back_populates="alternatives",
    )