import asyncio

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.enums import UserRole
from app.models.user import User


DEV_USERS = [
    {
        "employee_id": "WRK001",
        "full_name": "RailSync Maintenance Worker",
        "email": "worker@railsync.local",
        "password": "RailSync@123",
        "role": UserRole.WORKER,
        "zone": "Southern Railway",
        "division": "Chennai",
    },
    {
        "employee_id": "MGR001",
        "full_name": "RailSync Maintenance Manager",
        "email": "manager@railsync.local",
        "password": "RailSync@123",
        "role": UserRole.MANAGER,
        "zone": "Southern Railway",
        "division": "Chennai",
    },
    {
        "employee_id": "TOP001",
        "full_name": "RailSync Train Operator",
        "email": "operator@railsync.local",
        "password": "RailSync@123",
        "role": UserRole.TRAIN_OPERATOR,
        "zone": "Southern Railway",
        "division": "Chennai",
    },
]


async def seed_auth_users():
    async with AsyncSessionLocal() as session:

        created_count = 0
        skipped_count = 0

        for user_data in DEV_USERS:

            result = await session.execute(
                select(User).where(
                    User.employee_id
                    == user_data["employee_id"]
                )
            )

            existing_user = result.scalar_one_or_none()

            if existing_user is not None:
                print(
                    f"[SKIPPED] "
                    f"{user_data['employee_id']} "
                    f"already exists."
                )

                skipped_count += 1
                continue

            new_user = User(
                employee_id=user_data["employee_id"],
                full_name=user_data["full_name"],
                email=user_data["email"],
                password_hash=hash_password(
                    user_data["password"]
                ),
                role=user_data["role"],
                zone=user_data["zone"],
                division=user_data["division"],
                is_active=True,
            )

            session.add(new_user)

            print(
                f"[CREATED] "
                f"{user_data['employee_id']} "
                f"({user_data['role'].value})"
            )

            created_count += 1

        await session.commit()

        print()
        print("====================================")
        print("RailSync authentication seed complete")
        print("====================================")
        print(f"Created : {created_count}")
        print(f"Skipped : {skipped_count}")
        print()
        print("Development login accounts:")
        print()
        print("WORKER")
        print("Employee ID : WRK001")
        print("Password    : RailSync@123")
        print()
        print("MANAGER")
        print("Employee ID : MGR001")
        print("Password    : RailSync@123")
        print()
        print("TRAIN OPERATOR")
        print("Employee ID : TOP001")
        print("Password    : RailSync@123")
        print()
        print(
            "These credentials are DEVELOPMENT ONLY "
            "and must be replaced before deployment."
        )


if __name__ == "__main__":
    asyncio.run(seed_auth_users())