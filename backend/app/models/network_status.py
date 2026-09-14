from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.sql import func

from app.core.database import Base
from app.models.enums import OperationalStatus


class TrackStatusEvent(Base):
    __tablename__ = "track_status_events"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    track_id = Column(
        Integer,
        ForeignKey(
            "railway_tracks.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    status = Column(
        Enum(
            OperationalStatus,
            name="track_status_event_status",
        ),
        nullable=False,
        index=True,
    )

    reason = Column(
        Text,
        nullable=True,
    )

    source = Column(
        String(100),
        nullable=True,
    )

    starts_at = Column(
        DateTime(timezone=True),
        nullable=False,
    )

    ends_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class StationStatusEvent(Base):
    __tablename__ = "station_status_events"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    station_id = Column(
        Integer,
        ForeignKey(
            "railway_stations.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    status = Column(
        Enum(
            OperationalStatus,
            name="station_status_event_status",
        ),
        nullable=False,
        index=True,
    )

    reason = Column(
        Text,
        nullable=True,
    )

    source = Column(
        String(100),
        nullable=True,
    )

    starts_at = Column(
        DateTime(timezone=True),
        nullable=False,
    )

    ends_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
