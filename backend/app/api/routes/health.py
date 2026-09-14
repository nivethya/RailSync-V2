from fastapi import APIRouter
from sqlalchemy import text

from app.core.database import engine


router = APIRouter(
    prefix="/health",
    tags=["Health"],
)


@router.get("")
async def health():
    return {
        "status": "healthy",
        "service": "railsync-backend",
    }


@router.get("/db")
async def database_health():
    try:
        async with engine.connect() as connection:
            postgres_result = await connection.execute(
                text("SELECT version();")
            )

            postgis_result = await connection.execute(
                text("SELECT PostGIS_Version();")
            )

            return {
                "status": "healthy",
                "database": "connected",
                "postgresql": postgres_result.scalar(),
                "postgis": postgis_result.scalar(),
            }

    except Exception as exc:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(exc),
        }
