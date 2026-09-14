from geoalchemy2 import Geometry
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Enum,
    Integer,
    String,
)
from sqlalchemy.sql import func

from app.core.database import Base
from app.models.enums import OperationalStatus


class RailwayTrack(Base):
    __tablename__ = "railway_tracks"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    osm_id = Column(
        BigInteger,
        nullable=True,
        index=True,
    )

    name = Column(
        String(255),
        nullable=True,
    )

    line_name = Column(
        String(255),
        nullable=True,
        index=True,
    )

    railway_type = Column(
        String(100),
        nullable=True,
    )

    gauge = Column(
        String(50),
        nullable=True,
    )

    electrified = Column(
        Boolean,
        nullable=True,
    )

    track_count = Column(
        Integer,
        nullable=True,
    )

    operational_status = Column(
        Enum(
            OperationalStatus,
            name="track_operational_status",
        ),
        nullable=False,
        default=OperationalStatus.OPEN,
        index=True,
    )

    geometry = Column(
        Geometry(
            geometry_type="LINESTRING",
            srid=4326,
            spatial_index=True,
        ),
        nullable=False,
    )

    data_source = Column(
        String(100),
        nullable=True,
    )

    source_updated_at = Column(
        DateTime(timezone=True),
        nullable=True,
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
