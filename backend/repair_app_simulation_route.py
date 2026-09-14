from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
APP = ROOT.parent / "frontend" / "src" / "App.tsx"

if not APP.exists():
    raise SystemExit(f"Missing App.tsx: {APP}")

backup = APP.with_suffix(".tsx.before_simulation_fix")

if not backup.exists():
    backup.write_text(
        APP.read_text(encoding="utf-8"),
        encoding="utf-8",
    )

text = APP.read_text(encoding="utf-8")

# Ensure import exists exactly once.
import_line = 'import OperatorSimulation from "./pages/operator/OperatorSimulation";\n'

if import_line not in text:
    operator_imports = list(
        re.finditer(
            r'^import\s+Operator[A-Za-z0-9_]*\s+from\s+"[^"]+";\s*$',
            text,
            flags=re.MULTILINE,
        )
    )

    if operator_imports:
        pos = operator_imports[-1].end()
        text = text[:pos] + "\n" + import_line.rstrip("\n") + text[pos:]
    else:
        text = import_line + text

# Repair the malformed decisions/simulation JSX produced by the previous patch.
text = re.sub(
    r'<Route\s+path="/operator/decisions"\s+element=\{<OperatorDecisionLog\s*/>\s*'
    r'<Route\s+path="/operator/simulation"\s+element=\{<OperatorSimulation\s*/>\}\s*/>\s*'
    r'\}\s*/>',
    '<Route path="/operator/decisions" element={<OperatorDecisionLog />} />\n'
    '          <Route path="/operator/simulation" element={<OperatorSimulation />} />',
    text,
    flags=re.MULTILINE,
)

# Also repair the exact malformed two-line shape shown by TypeScript.
text = text.replace(
    '<Route path="/operator/decisions" element={<OperatorDecisionLog />\n'
    '          <Route path="/operator/simulation" element={<OperatorSimulation />} />} />',
    '<Route path="/operator/decisions" element={<OperatorDecisionLog />} />\n'
    '          <Route path="/operator/simulation" element={<OperatorSimulation />} />',
)

# If simulation route still does not exist, insert it immediately after decisions.
if 'path="/operator/simulation"' not in text:
    decisions_pattern = re.compile(
        r'(<Route\s+path="/operator/decisions"\s+element=\{<OperatorDecisionLog\s*/>\}\s*/>)'
    )
    match = decisions_pattern.search(text)

    if not match:
        raise SystemExit(
            "Could not find a valid /operator/decisions route. "
            "App.tsx backup was created but no unsafe edit was made."
        )

    indent_start = text.rfind("\n", 0, match.start()) + 1
    indent = text[indent_start:match.start()]

    text = (
        text[:match.end()]
        + "\n"
        + indent
        + '<Route path="/operator/simulation" element={<OperatorSimulation />} />'
        + text[match.end():]
    )

# Remove duplicate simulation routes if any.
lines = text.splitlines()
seen_sim = False
cleaned = []

for line in lines:
    if 'path="/operator/simulation"' in line:
        if seen_sim:
            continue
        seen_sim = True
    cleaned.append(line)

text = "\n".join(cleaned) + ("\n" if text.endswith("\n") else "")

APP.write_text(text, encoding="utf-8")

print("SUCCESS")
print("Fixed App.tsx operator simulation route.")
print("Backup:", backup)
