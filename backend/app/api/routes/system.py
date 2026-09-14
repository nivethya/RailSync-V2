from fastapi import APIRouter
from sqlalchemy import text

from app.core.database import engine


router = APIRouter(
    prefix="/system",
    tags=["System"],
)


@router.get("/database-summary")
async def database_summary():
    async with engine.connect() as connection:

        table_result = await connection.execute(
            text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_type = 'BASE TABLE'
                ORDER BY table_name;
            """)
        )

        tables = [
            row[0]
            for row in table_result.fetchall()
            if row[0] != "spatial_ref_sys"
        ]

        geometry_result = await connection.execute(
            text("""
                SELECT
                    f_table_name,
                    f_geometry_column,
                    type,
                    srid
                FROM geometry_columns
                ORDER BY f_table_name;
            """)
        )

        geometry_columns = [
            {
                "table": row[0],
                "column": row[1],
                "type": row[2],
                "srid": row[3],
            }
            for row in geometry_result.fetchall()
        ]

        version_result = await connection.execute(
            text("""
                SELECT version_num
                FROM alembic_version
                LIMIT 1;
            """)
        )

        alembic_version = version_result.scalar()

        return {
            "status": "healthy",
            "database": "railsync",
            "table_count": len(tables),
            "tables": tables,
            "geometry_columns": geometry_columns,
            "alembic_version": alembic_version,
        }
