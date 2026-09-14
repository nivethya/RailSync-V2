from fastapi import APIRouter

from app.api.routes.auth import (
    router as auth_router,
)

from app.api.routes.health import (
    router as health_router,
)

from app.api.routes.manager_operations import (
    router as manager_operations_router,
)

from app.api.routes.worker_operations import (
    router as worker_operations_router,
)

from app.api.routes.operator_operations import (
    router as operator_operations_router,
)

from app.api.routes.role_test import (
    router as role_test_router,
)

from app.api.routes.system import (
    router as system_router,
)


# =========================================================
# RAILSYNC API V1 ROUTER
# =========================================================

api_router = APIRouter()


# =========================================================
# HEALTH
# =========================================================

api_router.include_router(
    health_router,
)


# =========================================================
# SYSTEM
# =========================================================

api_router.include_router(
    system_router,
)


# =========================================================
# AUTHENTICATION
# =========================================================

api_router.include_router(
    auth_router,
)


# =========================================================
# ROLE ACCESS TEST
# =========================================================

api_router.include_router(
    role_test_router,
)


# =========================================================
# MANAGER OPERATIONS
# =========================================================

api_router.include_router(
    manager_operations_router,
)


# =========================================================
# WORKER OPERATIONS
# =========================================================

api_router.include_router(
    worker_operations_router,
)


# =========================================================
# TRAIN OPERATOR OPERATIONS
# =========================================================

api_router.include_router(
    operator_operations_router,
    tags=["Train Operator Operations"],
)