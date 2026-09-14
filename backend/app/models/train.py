from geoalchemy2 import Geometry
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Train(Base):
    __tablename__ = "trains"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    train_number = Column(
        String(20),
        unique=True,
        nullable=False,
        index=True,
    )

    train_name = Column(
        String(255),
        nullable=False,
        index=True,
    )

    train_type = Column(
        String(100),
        nullable=True,
    )

    source_station_code = Column(
        String(20),
        nullable=True,
        index=True,
    )

    destination_station_code = Column(
        String(20),
        nullable=True,
        index=True,
    )

    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
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

    positions = relationship(
        "TrainPosition",
        back_populates="train",
        cascade="all, delete-orphan",
    )


class TrainPosition(Base):
    __tablename__ = "train_positions"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    train_id = Column(
        Integer,
        ForeignKey(
            "trains.id",
            ondelete="CASCADE",
        ),
        nullable=False,
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

    speed_kmph = Column(
        Integer,
        nullable=True,
    )

    delay_minutes = Column(
        Integer,
        nullable=False,
        default=0,
    )

    current_station_code = Column(
        String(20),
        nullable=True,
    )

    next_station_code = Column(
        String(20),
        nullable=True,
    )

    source = Column(
        String(100),
        nullable=False,
    )

    is_live = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    recorded_at = Column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    train = relationship(
        "Train",
        back_populates="positions",
    )
