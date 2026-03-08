#!/usr/bin/env bash
set -euo pipefail

matrix=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --matrix)
      matrix="$2"
      shift 2
      ;;
    *)
      echo "unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -z "$matrix" ]]; then
  echo "usage: $0 --matrix <path>" >&2
  exit 2
fi

python3 - <<'PY' "$matrix"
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import yaml

matrix_path = Path(sys.argv[1]).resolve()
matrix = yaml.safe_load(matrix_path.read_text()) or {}
script_root = matrix_path.parent.parent
lock_records = []

for target in matrix.get("targets", []):
    name = target["name"]
    repo = target["repo"]
    sha = target["sha"]
    snapshot_path = Path(target["snapshot_path"]).resolve()
    snapshot_path.parent.mkdir(parents=True, exist_ok=True)

    if snapshot_path.exists():
        result = subprocess.run(["git", "-C", str(snapshot_path), "rev-parse", "HEAD"], capture_output=True, text=True)
        current = result.stdout.strip() if result.returncode == 0 else ""
        if current != sha:
            raise SystemExit(f"existing snapshot SHA mismatch for {name}: {current} != {sha}")
    else:
        subprocess.run(["git", "clone", repo, str(snapshot_path)], check=True)
        subprocess.run(["git", "-C", str(snapshot_path), "checkout", sha], check=True)

    digest = hashlib.sha256(f"{name}:{repo}:{sha}".encode("utf-8")).hexdigest()
    lock_records.append({"name": name, "sha": sha, "snapshot_path": str(snapshot_path), "lock_hash": digest})

lock_path = script_root / "config" / "target-locks.json"
lock_path.parent.mkdir(parents=True, exist_ok=True)
lock_path.write_text(json.dumps({"targets": lock_records}, indent=2, sort_keys=True) + "\n", encoding="utf-8")
print(str(lock_path))
PY
