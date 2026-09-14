"""
RailSync - Seed Train Operators using territories that ACTUALLY
contain disruption events in the current prototype database.

All operator accounts use:
    Password: RailSync@123

TOP001 = PAN-INDIA demo operator.
TOP002-TOP011 = territory-scoped operators mapped to zones/divisions
that currently have disruption events.
"""

import asyncio

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.user import User, UserRole


DEFAULT_PASSWORD = "RailSync@123"


OPERATORS = [
    {
        "employee_id": "TOP001",
        "full_name": "RailSync National Train Control",
        "email": "top001@railsync.local",
        "zone": "ALL",
        "division": "ALL",
        "scope": "PAN-INDIA",
    },
    {
        "employee_id": "TOP002",
        "full_name": "Chennai Train Control",
        "email": "top002@railsync.local",
        "zone": "SR",
        "division": "Chennai",
        "scope": "SR / Chennai",
    },
    {
        "employee_id": "TOP003",
        "full_name": "Lucknow Train Control",
        "email": "top003@railsync.local",
        "zone": "NR",
        "division": "Lucknow",
        "scope": "NR / Lucknow",
    },
    {
        "employee_id": "TOP004",
        "full_name": "Mumbai Train Control",
        "email": "top004@railsync.local",
        "zone": "CR",
        "division": "Mumbai",
        "scope": "CR / Mumbai",
    },
    {
        "employee_id": "TOP005",
        "full_name": "Delhi Train Control",
        "email": "top005@railsync.local",
        "zone": "NR",
        "division": "Delhi",
        "scope": "NR / Delhi",
    },
    {
        "employee_id": "TOP006",
        "full_name": "Hubballi Train Control",
        "email": "top006@railsync.local",
        "zone": "SWR",
        "division": "Hubballi",
        "scope": "SWR / Hubballi",
    },
    {
        "employee_id": "TOP007",
        "full_name": "Jaipur Train Control",
        "email": "top007@railsync.local",
        "zone": "NWR",
        "division": "Jaipur",
        "scope": "NWR / Jaipur",
    },
    {
        "employee_id": "TOP008",
        "full_name": "Vijayawada Train Control",
        "email": "top008@railsync.local",
        "zone": "SCR",
        "division": "Vijayawada",
        "scope": "SCR / Vijayawada",
    },
    {
        "employee_id": "TOP009",
        "full_name": "Thiruvananthapuram Train Control",
        "email": "top009@railsync.local",
        "zone": "SR",
        "division": "Thiruvananthapuram",
        "scope": "SR / Thiruvananthapuram",
    },
    {
        "employee_id": "TOP010",
        "full_name": "Ahmedabad Train Control",
        "email": "top010@railsync.local",
        "zone": "WR",
        "division": "Ahmedabad",
        "scope": "WR / Ahmedabad",
    },
    {
        "employee_id": "TOP011",
        "full_name": "Secunderabad Train Control",
        "email": "top011@railsync.local",
        "zone": "SCR",
        "division": "Secunderabad",
        "scope": "SCR / Secunderabad",
    },
]


async def seed_train_operators():
    password_hash = hash_password(DEFAULT_PASSWORD)

    async with AsyncSessionLocal() as db:
        created = 0
        updated = 0

        for item in OPERATORS:
            result = await db.execute(
                select(User).where(
                    User.employee_id == item["employee_id"]
                )
            )

            user = result.scalar_one_or_none()

            if user is None:
                user = User(
                    employee_id=item["employee_id"],
                    full_name=item["full_name"],
                    email=item["email"],
                    password_hash=password_hash,
                    role=UserRole.TRAIN_OPERATOR,
                    zone=item["zone"],
                    division=item["division"],
                    is_active=True,
                )
                db.add(user)
                created += 1
            else:
                user.full_name = item["full_name"]
                user.email = item["email"]
                user.password_hash = password_hash
                user.role = UserRole.TRAIN_OPERATOR
                user.zone = item["zone"]
                user.division = item["division"]
                user.is_active = True
                updated += 1

        await db.commit()

        print()
        print("=" * 82)
        print("RailSync Train Operator Seed Complete")
        print("=" * 82)
        print(f"Created operators : {created}")
        print(f"Updated operators : {updated}")
        print()
        print(f"Password for all accounts: {DEFAULT_PASSWORD}")
        print()
        print(f"{'ID':<8}{'Operator':<38}{'Control Scope'}")
        print("-" * 82)

        for item in OPERATORS:
            print(
                f"{item['employee_id']:<8}"
                f"{item['full_name']:<38}"
                f"{item['scope']}"
            )

        print("=" * 82)
        print()


if __name__ == "__main__":
    asyncio.run(seed_train_operators())
