"""
RailSync demo login verifier/provisioner.

Goal:
- Ensure WRK001..WRK050 have login-enabled User accounts
- Keep existing accounts unchanged
- Link each WorkerProfile.user_id to the correct User
- Use DEMO password RailSync@123 only for newly created accounts

Safe to run multiple times.
Does NOT delete or reseed operational data.
"""

import asyncio

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.operations import WorkerProfile
from app.models.user import User, UserRole


PASSWORD = "RailSync@123"
TARGET_LOGIN_WORKERS = 50


async def main():
    async with AsyncSessionLocal() as session:
        profiles = (
            await session.execute(
                select(WorkerProfile)
                .where(WorkerProfile.is_active.is_(True))
                .order_by(WorkerProfile.employee_code.asc())
            )
        ).scalars().all()

        target_profiles = [
            profile
            for profile in profiles
            if (
                profile.employee_code
                and profile.employee_code.startswith("WRK")
                and profile.employee_code[3:].isdigit()
                and int(profile.employee_code[3:]) <= TARGET_LOGIN_WORKERS
            )
        ]

        if not target_profiles:
            print("No WRK001..WRK050 worker profiles found.")
            return

        created = 0
        relinked = 0
        already_ok = 0
        password_hash = None

        for profile in target_profiles:
            code = profile.employee_code.upper()

            linked_user = None

            if profile.user_id is not None:
                linked_user = (
                    await session.execute(
                        select(User).where(
                            User.id == profile.user_id
                        )
                    )
                ).scalar_one_or_none()

            if (
                linked_user is not None
                and linked_user.employee_id == code
                and linked_user.role == UserRole.WORKER
            ):
                already_ok += 1
                continue

            existing_user = (
                await session.execute(
                    select(User).where(
                        User.employee_id == code
                    )
                )
            ).scalar_one_or_none()

            if existing_user is None:
                if password_hash is None:
                    password_hash = hash_password(PASSWORD)

                existing_user = User(
                    employee_id=code,
                    full_name=f"RailSync Worker {code}",
                    email=f"{code.lower()}@railsync.local",
                    password_hash=password_hash,
                    role=UserRole.WORKER,
                    zone=profile.railway_zone,
                    division=profile.division,
                    is_active=True,
                )
                session.add(existing_user)
                await session.flush()
                created += 1

            if profile.user_id != existing_user.id:
                profile.user_id = existing_user.id
                relinked += 1

        await session.commit()

        print()
        print("RAILSYNC WORKER LOGIN CHECK COMPLETE")
        print("------------------------------------")
        print(f"Target workers:     {len(target_profiles)}")
        print(f"Already linked:     {already_ok}")
        print(f"Accounts created:   {created}")
        print(f"Profiles relinked:  {relinked}")
        print()
        print("Demo login format:")
        print("WRK001 .. WRK050")
        print("Password: RailSync@123")
        print()
        print("Email equivalents:")
        print("wrk001@railsync.local .. wrk050@railsync.local")
        print()
        print("No operational jobs, assignments, faults, or worker data were deleted.")


if __name__ == "__main__":
    asyncio.run(main())
