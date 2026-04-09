#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
VENV_PYTHON="$ROOT_DIR/.venv-promptopt/bin/python"
SCRIPT_PATH="$ROOT_DIR/scripts/prompt-optimization/gepa_optimize_content_manager.py"

if [ -x "$VENV_PYTHON" ]; then
  exec "$VENV_PYTHON" "$SCRIPT_PATH" "$@"
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is not installed. Create .venv-promptopt or install Python 3.10+." >&2
  exit 1
fi

PYTHON_BIN="$(command -v python3)"
PYTHON_VERSION="$("$PYTHON_BIN" - <<'PY'
import sys
print(f"{sys.version_info.major}.{sys.version_info.minor}")
PY
)"

case "$PYTHON_VERSION" in
  3.1[0-9]|[4-9].*)
    exec "$PYTHON_BIN" "$SCRIPT_PATH" "$@"
    ;;
  *)
    echo "GEPA requires Python 3.10+. Current python3 is $PYTHON_VERSION." >&2
    echo "Create .venv-promptopt with a newer interpreter, then rerun this command." >&2
    exit 1
    ;;
esac
