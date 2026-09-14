from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.database import Base
from app.core.settings import settings

from app.models import (
    AuditLog,
    RailwayStation,
    RailwayTrack,
    StationStatusEvent,
    TrackStatusEvent,
    Train,
    TrainPosition,
    User,
)


config = context.config


if config.config_file_name is not None:
    fileConfig(config.config_file_name)


sync_database_url = settings.database_url.replace(
    "postgresql+asyncpg://",
    "postgresql+psycopg://",
)

config.set_main_option(
    "sqlalchemy.url",
    sync_database_url,
)


target_metadata = Base.metadata


POSTGIS_SYSTEM_TABLES = {
    "spatial_ref_sys",
    "geometry_columns",
    "geography_columns",
}


def include_object(
    object,
    name,
    type_,
    reflected,
    compare_to,
):
    if type_ == "table" and name in POSTGIS_SYSTEM_TABLES:
        return False

    return True


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(
            config.config_ini_section,
            {}
        ),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            include_object=include_object,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
