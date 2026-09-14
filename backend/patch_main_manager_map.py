from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAIN = ROOT / "app" / "main.py"

if not MAIN.exists():
    raise SystemExit(f"Missing {MAIN}")

backup = MAIN.with_suffix(".py.before_manager_map")

if not backup.exists():
    backup.write_text(
        MAIN.read_text(encoding="utf-8"),
        encoding="utf-8",
    )

text = MAIN.read_text(encoding="utf-8")

import_line = "from app.api.routes import manager_map_operations\n"

if import_line not in text:
    anchor = "from app.api.routes import manager_operations\n"

    if anchor in text:
        text = text.replace(
            anchor,
            anchor + import_line,
            1,
        )
    else:
        text = import_line + text

include_line = "app.include_router(manager_map_operations.router)\n"

if include_line not in text:
    anchor = "app.include_router(manager_operations.router)\n"

    if anchor in text:
        text = text.replace(
            anchor,
            anchor + include_line,
            1,
        )
    else:
        text += "\n" + include_line

MAIN.write_text(
    text,
    encoding="utf-8",
)

print("SUCCESS")
print("Registered manager_map_operations router.")
print("Backup:", backup)
