from pathlib import Path

ROOT = Path(__file__).resolve().parent
APP = ROOT.parent / "frontend" / "src" / "App.tsx"

if not APP.exists():
    raise SystemExit(f"Missing App.tsx: {APP}")

backup = APP.with_suffix(".tsx.before_simulation")

if not backup.exists():
    backup.write_text(
        APP.read_text(encoding="utf-8"),
        encoding="utf-8",
    )

text = APP.read_text(encoding="utf-8")

import_line = (
    'import OperatorSimulation from '
    '"./pages/operator/OperatorSimulation";\n'
)

if "OperatorSimulation" not in text:
    # Put near any existing operator page import.
    anchors = [
        'import OperatorDecisionLog',
        'import OperatorAlternatives',
        'import OperatorDashboard',
    ]

    inserted = False

    for anchor in anchors:
        pos = text.find(anchor)

        if pos >= 0:
            line_end = text.find("\n", pos)

            if line_end >= 0:
                text = (
                    text[:line_end + 1]
                    + import_line
                    + text[line_end + 1:]
                )
                inserted = True
                break

    if not inserted:
        text = import_line + text

route_line = (
    '        <Route path="/operator/simulation" '
    'element={<OperatorSimulation />} />\n'
)

if 'path="/operator/simulation"' not in text:
    anchors = [
        'path="/operator/decisions"',
        'path="/operator/alternatives"',
        'path="/operator"',
    ]

    inserted = False

    for anchor in anchors:
        pos = text.find(anchor)

        if pos >= 0:
            route_start = text.rfind("<Route", 0, pos)
            route_end = text.find("/>", pos)

            if route_start >= 0 and route_end >= 0:
                route_end += 2

                indent_start = text.rfind("\n", 0, route_start) + 1
                indent = text[indent_start:route_start]

                text = (
                    text[:route_end]
                    + "\n"
                    + indent
                    + '<Route path="/operator/simulation" element={<OperatorSimulation />} />'
                    + text[route_end:]
                )
                inserted = True
                break

    if not inserted:
        raise SystemExit(
            "Could not safely find Operator route group in App.tsx. "
            "Backup was created; App.tsx not changed."
        )

APP.write_text(
    text,
    encoding="utf-8",
)

print("SUCCESS")
print("Added OperatorSimulation import and /operator/simulation route.")
print("Backup:", backup)
