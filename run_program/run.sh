#!/bin/bash
set -e

echo "=============================="
echo "  EpicStaff - Run Project"
echo "=============================="
echo

# Run remove_containers first
"$(
  dirname "$0"
)/remove_containers.sh"

SRC_DIR="$(dirname "$0")/../src"
cd "$SRC_DIR" || { echo "Directory not found: $SRC_DIR"; exit 1; }

# Start containers in detached mode
docker compose --project-name "epicstaff" up -d

echo "[OK] EpicStaff is running."
