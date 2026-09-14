from collections.abc import Callable

from fastapi import Depends, HTTPException, status

from app.dependencies.auth import get_current_user
from app.models.enums import UserRole
from app.models.user import User


def require_roles(
    *allowed_roles: UserRole,
) -> Callable:

    async def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:

        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource",
            )

        return current_user

    return role_checker


get_current_worker = require_roles(
    UserRole.WORKER,
)

get_current_manager = require_roles(
    UserRole.MANAGER,
)

get_current_train_operator = require_roles(
    UserRole.TRAIN_OPERATOR,
)

get_current_manager_or_operator = require_roles(
    UserRole.MANAGER,
    UserRole.TRAIN_OPERATOR,
)