from pydantic import BaseModel, Field

from app.models.enums import UserRole


class LoginRequest(BaseModel):
    employee_id: str = Field(
        min_length=2,
        max_length=50,
    )

    password: str = Field(
        min_length=6,
        max_length=128,
    )

    role: UserRole


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str

    token_type: str = "bearer"

    user_id: int
    employee_id: str
    full_name: str
    role: UserRole


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class CurrentUserResponse(BaseModel):
    id: int
    employee_id: str
    full_name: str

    email: str | None

    role: UserRole

    zone: str | None
    division: str | None

    is_active: bool

    model_config = {
        "from_attributes": True
    }