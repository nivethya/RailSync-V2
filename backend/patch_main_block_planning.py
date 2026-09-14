from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAIN = ROOT / "app" / "main.py"

if not MAIN.exists():
    raise SystemExit(
        f"Missing: {MAIN}"
    )

backup = MAIN.with_suffix(
    ".py.before_block_planning"
)

if not backup.exists():
    backup.write_text(
        MAIN.read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

text = MAIN.read_text(
    encoding="utf-8"
)

import_line = (
    "from app.api.routes import block_planning\n"
)

if import_line not in text:
    # Place next to other route-module imports.
    anchor = (
        "from app.api.routes import "
        "operator_operations\n"
    )

    if anchor in text:
        text = text.replace(
            anchor,
            anchor + import_line,
            1,
        )
    else:
        # Generic safe fallback.
        text = (
            import_line
            + text
        )

include_line = (
    "app.include_router("
    "block_planning.router"
    ")\n"
)

if include_line not in text:
    # Add after operator router if possible.
    anchor = (
        "app.include_router("
        "operator_operations.router"
        ")\n"
    )

    if anchor in text:
        text = text.replace(
            anchor,
            anchor + include_line,
            1,
        )
    else:
        # Insert before __main__ or EOF.
        text += (
            "\n"
            + include_line
        )

MAIN.write_text(
    text,
    encoding="utf-8",
)

print("SUCCESS")
print("Registered block_planning router in app/main.py")
print("Backup:", backup)
