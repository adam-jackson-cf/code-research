#!/usr/bin/env bash
set -euo pipefail

fixture=""
dest=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --fixture)
      fixture="$2"
      shift 2
      ;;
    --dest)
      dest="$2"
      shift 2
      ;;
    *)
      echo "unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -z "$fixture" || -z "$dest" ]]; then
  echo "usage: $0 --fixture <backend-min|ui-min> --dest <path>" >&2
  exit 2
fi

script_dir="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$script_dir/.." && pwd)"
src="$root/fixtures/targets/$fixture"

if [[ ! -d "$src" ]]; then
  echo "fixture not found: $fixture" >&2
  exit 2
fi

if [[ -d "$dest" ]] && [[ -n "$(find "$dest" -mindepth 1 -print -quit)" ]]; then
  echo "destination must be empty: $dest" >&2
  exit 2
fi

mkdir -p "$dest"
cp -R "$src"/. "$dest"/

( cd "$dest" && find . -type f | sort )
