#!/bin/bash
set -e

echo "=============================="
echo "  EpicStaff - Update Project"
echo "=============================="
echo

# Run remove_containers first
"$(
  dirname "$0"
)/remove_containers.sh"

SRC_DIR="$(dirname "$0")/../src"
cd "$SRC_DIR" || { echo "Directory not found: $SRC_DIR"; exit 1; }

# Build project
docker compose build

# Create volumes
docker volume create crew_pgdata >/dev/null 2>&1
docker volume create sandbox_venvs >/dev/null 2>&1
docker volume create sandbox_executions >/dev/null 2>&1
docker volume create crew_config >/dev/null 2>&1

# Start containers in detached mode
docker compose --project-name "epicstaff" up -d

# Wait until all containers are healthy
echo "[INFO] Waiting for containers to become healthy..."
while [ "$(docker ps --filter "health=unhealthy" --format '{{.ID}}')" != "" ]; do
    sleep 2
done

echo "[OK] Update complete."

# Remove containers again
"$(
  dirname "$0"
)/remove_containers.sh"
