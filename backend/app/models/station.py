from geoalchemy2 import Geometry
from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    Integer,
    String,
)
from sqlalchemy.sql import func

from app.core.database import Base
from app.models.enums import OperationalStatus, StationType


class RailwayStation(Base):
    __tablename__ = "railway_stations"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    station_code = Column(
        String(20),
        unique=True,
        nullable=False,
        index=True,
    )

    station_name = Column(
        String(200),
        nullable=False,
        index=True,
    )

    station_type = Column(
        Enum(
            StationType,
            name="station_type",
        ),
        nullable=False,
        default=StationType.STATION,
        index=True,
    )

    state = Column(
        String(100),
        nullable=True,
    )

    district = Column(
        String(100),
        nullable=True,
    )

    zone = Column(
        String(100),
        nullable=True,
    )

    division = Column(
        String(100),
        nullable=True,
    )

    operational_status = Column(
        Enum(
            OperationalStatus,
            name="station_operational_status",
        ),
        nullable=False,
        default=OperationalStatus.OPEN,
        index=True,
    )

    geometry = Column(
        Geometry(
            geometry_type="POINT",
            srid=4326,
            spatial_index=True,
        ),
        nullable=False,
    )

    data_source = Column(
        String(100),
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
