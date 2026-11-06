#!/bin/bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
godot_bin="${GODOT_BIN:-/private/tmp/flight-islands-tools/Godot.app/Contents/MacOS/Godot}"
if [[ ! -x "$godot_bin" ]]; then
  echo "Godot 4.7.2 not found. Set GODOT_BIN to its executable." >&2
  exit 1
fi
mkdir -p "$project_dir/output"
exec "$godot_bin" --log-file "$project_dir/output/runtime.log" --audio-driver Dummy --path "$project_dir" "$@" -- --test-muted
