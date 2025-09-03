#!/bin/bash
# update.sh - Update the EpicStaff project

echo "============================="
echo "   EpicStaff - Update Project"
echo "============================="
echo

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run remove_containers first
"$SCRIPT_DIR/remove_containers.sh"

# Change to src directory
cd "$SCRIPT_DIR/../src"

# Build project
docker compose build

# Create volumes
docker volume create crew_pgdata > /dev/null 2>&1
docker volume create sandbox_venvs > /dev/null 2>&1
docker volume create sandbox_executions > /dev/null 2>&1
docker volume create crew_config > /dev/null 2>&1

# Start containers in detached mode
docker compose --project-name "epicstaff" up -d

# Wait until all containers are healthy
echo "[INFO] Waiting for containers to become healthy..."
while [ -n "$(docker ps --filter 'health=unhealthy' --format '{{.ID}}')" ]; do
    sleep 2
done

echo "[OK] Update complete."

# Remove containers again
"$SCRIPT_DIR/remove_containers.sh"

read -p "Press Enter to continue..."