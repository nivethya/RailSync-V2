from fastapi import (
    APIRouter,
    WebSocket,
    WebSocketDisconnect,
)
from jose import JWTError
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import decode_token
from app.models.user import User
from app.websocket.realtime_manager import (
    realtime_manager,
)


router = APIRouter(
    tags=["Realtime"],
)


@router.websocket(
    "/ws"
)
async def railsync_websocket(
    websocket: WebSocket,
):
    """
    Connect using:

    ws://127.0.0.1:8000/api/v1/ws?token=<JWT>

    The JWT identifies:
    - user
    - role

    Each connection is automatically assigned
    to the proper RailSync realtime channels.
    """

    token = websocket.query_params.get(
        "token"
    )

    if not token:
        await websocket.close(
            code=4401
        )

        return


    try:
        payload = decode_token(
            token
        )

        if (
            payload.get("type")
            != "access"
        ):
            await websocket.close(
                code=4401
            )

            return


        subject = payload.get(
            "sub"
        )

        if subject is None:
            await websocket.close(
                code=4401
            )

            return


        user_id = int(
            subject
        )


    except (
        JWTError,
        ValueError,
        TypeError,
    ):
        await websocket.close(
            code=4401
        )

        return


    async with AsyncSessionLocal() as db:

        result = await db.execute(
            select(
                User
            )
            .where(
                User.id
                == user_id
            )
        )

        user = (
            result.scalar_one_or_none()
        )


    if (
        not user
        or not user.is_active
    ):
        await websocket.close(
            code=4403
        )

        return


    token_role = payload.get(
        "role"
    )

    if (
        token_role
        != user.role.value
    ):
        await websocket.close(
            code=4403
        )

        return


    role = user.role.value


    await realtime_manager.connect(
        websocket=
            websocket,

        user_id=
            user.id,

        role=
            role,
    )


    try:

        await websocket.send_json(
            {
                "type":
                    "CONNECTED",

                "message":
                    "RailSync realtime channel connected",

                "user_id":
                    user.id,

                "role":
                    role,
            }
        )


        while True:

            message = (
                await websocket.receive_text()
            )


            # Simple heartbeat support
            if (
                message.strip().lower()
                == "ping"
            ):

                await websocket.send_json(
                    {
                        "type":
                            "PONG",
                    }
                )


    except WebSocketDisconnect:

        realtime_manager.disconnect(
            websocket=
                websocket,

            user_id=
                user.id,

            role=
                role,
        )


    except Exception:

        realtime_manager.disconnect(
            websocket=
                websocket,

            user_id=
                user.id,

            role=
                role,
        )

        try:
            await websocket.close()

        except Exception:
            pass