from pathlib import Path
import json
import joblib

ROOT = Path(__file__).resolve().parent

candidates = [
    ROOT / "ml" / "models",
    ROOT.parent / "ml" / "models",
    ROOT / "models",
]

model_dir = next((p for p in candidates if p.exists()), None)

if model_dir is None:
    print("MODEL_DIR_NOT_FOUND")
    print("Checked:")
    for p in candidates:
        print(" -", p)
    raise SystemExit(1)

print("MODEL_DIR:", model_dir)
print()

files = sorted(
    list(model_dir.glob("*.joblib"))
    + list(model_dir.glob("*.pkl"))
)

if not files:
    print("NO_MODEL_FILES_FOUND")
    raise SystemExit(1)

for path in files:
    print("=" * 72)
    print("FILE:", path.name)

    try:
        model = joblib.load(path)
    except Exception as exc:
        print("LOAD_ERROR:", repr(exc))
        continue

    print("TYPE:", type(model).__name__)
    print("MODULE:", type(model).__module__)

    if hasattr(model, "feature_names_in_"):
        try:
            print(
                "FEATURE_NAMES_IN:",
                json.dumps(
                    [str(x) for x in model.feature_names_in_],
                    indent=2,
                ),
            )
        except Exception as exc:
            print("FEATURE_NAMES_IN_ERROR:", repr(exc))
    else:
        print("FEATURE_NAMES_IN: <not available>")

    if hasattr(model, "n_features_in_"):
        print("N_FEATURES_IN:", getattr(model, "n_features_in_"))

    if hasattr(model, "classes_"):
        try:
            print(
                "CLASSES:",
                json.dumps(
                    [str(x) for x in model.classes_],
                    indent=2,
                ),
            )
        except Exception as exc:
            print("CLASSES_ERROR:", repr(exc))

    if hasattr(model, "get_params"):
        try:
            params = model.get_params()
            print("MODEL_PARAMS_KEYS:", sorted(params.keys())[:30])
        except Exception:
            pass

    if hasattr(model, "named_steps"):
        print("PIPELINE_STEPS:", list(model.named_steps.keys()))

        for step_name, step in model.named_steps.items():
            print(
                f"  STEP {step_name}:",
                type(step).__name__,
            )

            if hasattr(step, "feature_names_in_"):
                try:
                    print(
                        f"  STEP {step_name} FEATURE_NAMES:",
                        [str(x) for x in step.feature_names_in_],
                    )
                except Exception:
                    pass

    print()

print("=" * 72)
print("DONE")

