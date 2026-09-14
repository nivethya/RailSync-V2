import enum


class UserRole(str, enum.Enum):
    WORKER = "WORKER"
    MANAGER = "MANAGER"
    TRAIN_OPERATOR = "TRAIN_OPERATOR"


class StationType(str, enum.Enum):
    STATION = "STATION"
    JUNCTION = "JUNCTION"
    HALT = "HALT"
    TERMINAL = "TERMINAL"
    YARD = "YARD"
    OTHER = "OTHER"


class OperationalStatus(str, enum.Enum):
    OPEN = "OPEN"
    RESTRICTED = "RESTRICTED"
    MAINTENANCE = "MAINTENANCE"
    PARTIAL_BLOCK = "PARTIAL_BLOCK"
    BLOCKED = "BLOCKED"
    TEMP_CLOSED = "TEMP_CLOSED"
    EMERGENCY_CLOSED = "EMERGENCY_CLOSED"


class DataSourceType(str, enum.Enum):
    OFFICIAL = "OFFICIAL"
    PUBLIC = "PUBLIC"
    MANUAL = "MANUAL"
    REPLAY = "REPLAY"
    SYNTHETIC = "SYNTHETIC"
