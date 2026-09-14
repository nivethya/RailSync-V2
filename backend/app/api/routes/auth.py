from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.auth import (
    CurrentUserResponse,
    LoginRequest,
    RefreshTokenRequest,
    TokenResponse,
)


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post(
    "/login",
    response_model=TokenResponse,
)
async def login(
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(
            User.employee_id == login_data.employee_id
        )
    )

    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid employee ID, password, or role",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    if user.role != login_data.role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid employee ID, password, or role",
        )

    if not verify_password(
        login_data.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid employee ID, password, or role",
        )

    access_token = create_access_token(
        subject=str(user.id),
        role=user.role.value,
        extra={
            "employee_id": user.employee_id,
        },
    )

    refresh_token = create_refresh_token(
        subject=str(user.id),
        role=user.role.value,
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user.id,
        employee_id=user.employee_id,
        full_name=user.full_name,
        role=user.role,
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
)
async def refresh_access_token(
    refresh_data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        payload = decode_token(
            refresh_data.refresh_token
        )

        if payload.get("type") != "refresh":
            raise ValueError(
                "Token is not a refresh token"
            )

        subject = payload.get("sub")
        token_role = payload.get("role")

        if subject is None or token_role is None:
            raise ValueError(
                "Invalid refresh token payload"
            )

        user_id = int(subject)

    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    result = await db.execute(
        select(User).where(
            User.id == user_id
        )
    )

    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    if user.role.value != token_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User role has changed",
        )

    new_access_token = create_access_token(
        subject=str(user.id),
        role=user.role.value,
        extra={
            "employee_id": user.employee_id,
        },
    )

    new_refresh_token = create_refresh_token(
        subject=str(user.id),
        role=user.role.value,
    )

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        user_id=user.id,
        employee_id=user.employee_id,
        full_name=user.full_name,
        role=user.role,
    )


@router.get(
    "/me",
    response_model=CurrentUserResponse,
)
async def get_my_profile(
    current_user: User = Depends(
        get_current_user
    ),
):
    return current_user