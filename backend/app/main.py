from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_redoc_html, get_swagger_ui_html
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.routes import block_planning
from app.api.routes.auth import router as auth_router
from app.api.routes.health import router as health_router
from app.api.routes.manager_operations import (
    router as manager_operations_router,
)
from app.api.routes.operator_operations import (
    router as operator_operations_router,
)
from app.api.routes.realtime import router as realtime_router
from app.api.routes.role_test import router as role_test_router
from app.api.routes.system import router as system_router
from app.api.routes.worker_operations import (
    router as worker_operations_router,
)
from app.core.database import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        async with engine.begin() as connection:
            await connection.execute(
                text("SELECT 1")
            )

            postgis_result = await connection.execute(
                text(
                    """
                    SELECT EXISTS (
                        SELECT 1
                        FROM pg_extension
                        WHERE extname = 'postgis'
                    )
                    """
                )
            )

            postgis_available = bool(
                postgis_result.scalar()
            )

            print("")
            print("========================================")
            print("RailSync Backend")
            print("========================================")
            print("PostgreSQL connection: OK")
            print(
                "PostGIS extension:",
                "OK"
                if postgis_available
                else "NOT FOUND",
            )
            print("========================================")
            print("")

    except Exception as exc:
        print("")
        print("RailSync database startup failed")
        print(str(exc))
        print("")
        raise

    yield

    await engine.dispose()


# ---------------------------------------------------------
# APPLICATION
# ---------------------------------------------------------

app = FastAPI(
    title="RailSync API",
    description=(
        "AI-powered railway maintenance, "
        "automatic block planning, "
        "worker coordination and "
        "train disruption management system."
    ),
    version="2.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://rail-sync-v2-h8ob73qgm-forge-6ace.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# ROOT
# ---------------------------------------------------------

@app.get(
    "/",
    tags=["System"],
)
async def root():
    return {
        "application": "RailSync",
        "version": "2.0.0",
        "status": "running",
        "environment": "production",
        "api_docs": "/docs",
        "openapi": "/openapi.json",
    }


# ---------------------------------------------------------
# MANUAL OPENAPI SCHEMA
# ---------------------------------------------------------

@app.get(
    "/openapi.json",
    include_in_schema=False,
)
async def openapi_schema():
    schema = app.openapi()

    return JSONResponse(
        content=schema,
    )


# ---------------------------------------------------------
# MANUAL SWAGGER UI
# ---------------------------------------------------------

@app.get(
    "/docs",
    include_in_schema=False,
)
async def swagger_docs():
    return get_swagger_ui_html(
        openapi_url="/openapi.json",
        title="RailSync API - Swagger UI",
        swagger_favicon_url=(
            "https://fastapi.tiangolo.com/img/favicon.png"
        ),
    )


# ---------------------------------------------------------
# MANUAL REDOC
# ---------------------------------------------------------

@app.get(
    "/redoc",
    include_in_schema=False,
)
async def redoc_docs():
    return get_redoc_html(
        openapi_url="/openapi.json",
        title="RailSync API - ReDoc",
    )


# ---------------------------------------------------------
# API ROUTERS
# ---------------------------------------------------------

app.include_router(
    health_router,
    prefix="/api/v1",
)

app.include_router(
    system_router,
    prefix="/api/v1",
)

app.include_router(
    auth_router,
    prefix="/api/v1",
)

app.include_router(
    role_test_router,
    prefix="/api/v1",
)

app.include_router(
    manager_operations_router,
    prefix="/api/v1",
)

app.include_router(
    worker_operations_router,
    prefix="/api/v1",
)

app.include_router(
    operator_operations_router,
    prefix="/api/v1",
)

app.include_router(
    realtime_router,
    prefix="/api/v1",
)

app.include_router(
    block_planning.router,
)