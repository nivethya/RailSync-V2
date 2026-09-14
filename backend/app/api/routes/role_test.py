from fastapi import APIRouter, Depends

from app.dependencies.roles import (
    get_current_manager,
    get_current_train_operator,
    get_current_worker,
)
from app.models.user import User


router = APIRouter(
    prefix="/access",
    tags=["Role Access Test"],
)


@router.get("/worker")
async def worker_only(
    current_user: User = Depends(get_current_worker),
):
    return {
        "status": "allowed",
        "portal": "WORKER",
        "employee_id": current_user.employee_id,
        "full_name": current_user.full_name,
        "role": current_user.role.value,
    }


@router.get("/manager")
async def manager_only(
    current_user: User = Depends(get_current_manager),
):
    return {
        "status": "allowed",
        "portal": "MANAGER",
        "employee_id": current_user.employee_id,
        "full_name": current_user.full_name,
        "role": current_user.role.value,
    }


@router.get("/train-operator")
async def train_operator_only(
    current_user: User = Depends(
        get_current_train_operator
    ),
):
    return {
        "status": "allowed",
        "portal": "TRAIN_OPERATOR",
        "employee_id": current_user.employee_id,
        "full_name": current_user.full_name,
        "role": current_user.role.value,
    }