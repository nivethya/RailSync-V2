from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class RealtimeManager:
    """
    RailSync realtime connection manager.

    Connections are separated by:
    - individual user
    - role

    This lets us send:
    Manager -> specific Worker
    Worker  -> all Managers
    Manager -> all Train Operators
    """

    def __init__(self):
        self.user_connections: dict[
            int,
            set[WebSocket],
        ] = defaultdict(set)

        self.role_connections: dict[
            str,
            set[WebSocket],
        ] = defaultdict(set)


    async def connect(
        self,
        websocket: WebSocket,
        user_id: int,
        role: str,
    ):
        await websocket.accept()

        self.user_connections[
            user_id
        ].add(
            websocket
        )

        self.role_connections[
            role
        ].add(
            websocket
        )


    def disconnect(
        self,
        websocket: WebSocket,
        user_id: int,
        role: str,
    ):
        if (
            user_id
            in self.user_connections
        ):
            self.user_connections[
                user_id
            ].discard(
                websocket
            )

            if not self.user_connections[
                user_id
            ]:
                del self.user_connections[
                    user_id
                ]


        if (
            role
            in self.role_connections
        ):
            self.role_connections[
                role
            ].discard(
                websocket
            )

            if not self.role_connections[
                role
            ]:
                del self.role_connections[
                    role
                ]


    async def send_to_user(
        self,
        user_id: int,
        event: dict[str, Any],
    ):
        connections = list(
            self.user_connections.get(
                user_id,
                set(),
            )
        )

        dead_connections = []

        for websocket in connections:
            try:
                await websocket.send_json(
                    event
                )

            except Exception:
                dead_connections.append(
                    websocket
                )


        for websocket in dead_connections:
            self.user_connections[
                user_id
            ].discard(
                websocket
            )


    async def send_to_role(
        self,
        role: str,
        event: dict[str, Any],
    ):
        connections = list(
            self.role_connections.get(
                role,
                set(),
            )
        )

        dead_connections = []

        for websocket in connections:
            try:
                await websocket.send_json(
                    event
                )

            except Exception:
                dead_connections.append(
                    websocket
                )


        for websocket in dead_connections:
            self.role_connections[
                role
            ].discard(
                websocket
            )


    async def broadcast(
        self,
        event: dict[str, Any],
    ):
        seen = set()

        for connections in (
            self.user_connections.values()
        ):
            for websocket in list(
                connections
            ):
                if id(websocket) in seen:
                    continue

                seen.add(
                    id(websocket)
                )

                try:
                    await websocket.send_json(
                        event
                    )

                except Exception:
                    pass


realtime_manager = RealtimeManager()