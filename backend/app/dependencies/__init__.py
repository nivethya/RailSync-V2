from app.dependencies.auth import (
    get_current_user,
    oauth2_scheme,
)

from app.dependencies.roles import (
    get_current_manager,
    get_current_manager_or_operator,
    get_current_train_operator,
    get_current_worker,
    require_roles,
)


__all__ = [
    "get_current_user",
    "oauth2_scheme",
    "require_roles",
    "get_current_worker",
    "get_current_manager",
    "get_current_train_operator",
    "get_current_manager_or_operator",
]