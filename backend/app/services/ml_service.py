from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
import warnings

warnings.filterwarnings(
    "ignore",
    message=".*sklearn.utils.parallel.delayed.*",
    category=UserWarning,
)


HERE = Path(__file__).resolve()
BACKEND_DIR = HERE.parents[2]
PROJECT_DIR = BACKEND_DIR.parent

MODEL_DIR_CANDIDATES = [
    PROJECT_DIR / "ml" / "models",
    BACKEND_DIR / "ml" / "models",
]


def _model_dir() -> Path:
    for candidate in MODEL_DIR_CANDIDATES:
        if candidate.exists():
            return candidate
    return MODEL_DIR_CANDIDATES[0]


MODEL_DIR = _model_dir()


def _enum_value(value: Any, default: str = "UNKNOWN") -> str:
    if value is None:
        return default
    return str(getattr(value, "value", value))


def _num(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return float(default)
        return float(value)
    except Exception:
        return float(default)


@lru_cache(maxsize=3)
def _load_model(filename: str):
    path = MODEL_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"RailSync ML model not found: {path}")
    return joblib.load(path)


def model_status() -> dict[str, Any]:
    files = {
        "maintenance_priority": "maintenance_priority_model.joblib",
        "worker_assignment": "worker_assignment_model.joblib",
        "train_delay": "train_delay_model.joblib",
    }

    result: dict[str, Any] = {
        "model_directory": str(MODEL_DIR),
        "models": {},
    }

    for key, filename in files.items():
        path = MODEL_DIR / filename
        loaded = False
        error = None

        if path.exists():
            try:
                _load_model(filename)
                loaded = True
            except Exception as exc:
                error = str(exc)

        result["models"][key] = {
            "filename": filename,
            "exists": path.exists(),
            "loaded": loaded,
            "size_bytes": path.stat().st_size if path.exists() else 0,
            "error": error,
        }

    result["all_loaded"] = all(
        item["loaded"]
        for item in result["models"].values()
    )

    return result


def predict_maintenance_priority(job: Any) -> float:
    model = _load_model("maintenance_priority_model.joblib")

    frame = pd.DataFrame([{
        "severity": _enum_value(getattr(job, "severity", None), "MEDIUM"),
        "asset_type": str(getattr(job, "asset_type", None) or "UNKNOWN"),
        "job_type": str(getattr(job, "job_type", None) or "UNKNOWN"),
        "required_skill": str(getattr(job, "required_skill", None) or "UNKNOWN"),
        "required_authority": str(getattr(job, "required_authority", None) or "NONE"),
        "estimated_minutes": _num(getattr(job, "estimated_minutes", None)),
        "predicted_failure_risk": _num(getattr(job, "predicted_failure_risk", None)),
        "estimated_delay_minutes": _num(getattr(job, "estimated_delay_minutes", None)),
        "expected_train_impact": _num(getattr(job, "expected_train_impact", None)),
        "block_required": 1.0 if bool(getattr(job, "block_required", False)) else 0.0,
    }])

    score = float(model.predict(frame)[0])
    return round(max(0.0, min(100.0, score)), 2)


def predict_worker_suitability(
    *,
    job: Any,
    worker: Any,
    availability: Any,
    proficiency_level: int | float,
    has_required_skill: bool,
    same_zone: bool = False,
) -> float:
    model = _load_model("worker_assignment_model.joblib")

    frame = pd.DataFrame([{
        "job_severity": _enum_value(getattr(job, "severity", None), "MEDIUM"),
        "required_skill": str(getattr(job, "required_skill", None) or "UNKNOWN"),
        "required_authority": str(getattr(job, "required_authority", None) or "NONE"),
        "worker_department": str(getattr(worker, "department", None) or "UNKNOWN"),
        "worker_zone": str(getattr(worker, "railway_zone", None) or "UNKNOWN"),
        "availability": _enum_value(getattr(availability, "status", None), "UNAVAILABLE"),
        "estimated_minutes": _num(getattr(job, "estimated_minutes", None)),
        "worker_experience_years": _num(getattr(worker, "years_experience", None)),
        "proficiency_level": _num(proficiency_level),
        "has_required_skill": 1.0 if has_required_skill else 0.0,
        "max_daily_minutes": _num(getattr(worker, "max_daily_minutes", None), 360),
        "same_zone": 1.0 if same_zone else 0.0,
    }])

    score = float(model.predict(frame)[0])
    return round(max(0.0, min(100.0, score)), 2)


def predict_train_delay(
    *,
    disruption: Any,
    train: Any,
) -> float:
    model = _load_model("train_delay_model.joblib")

    scheduled = getattr(train, "scheduled_passage", None)
    hour = float(scheduled.hour if scheduled is not None else 12)

    frame = pd.DataFrame([{
        "disruption_severity": _enum_value(getattr(disruption, "severity", None), "MEDIUM"),
        "priority_class": str(getattr(train, "priority_class", None) or "NORMAL"),
        "disruption_estimated_delay": _num(getattr(disruption, "estimated_delay_minutes", None)),
        "hour_of_day": hour,
        "is_peak_hour": 1.0 if int(hour) in {7, 8, 9, 10, 17, 18, 19, 20, 21} else 0.0,
    }])

    delay = float(model.predict(frame)[0])
    return round(max(0.0, delay), 2)
