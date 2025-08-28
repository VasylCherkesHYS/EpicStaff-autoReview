#!/bin/bash
set -e

echo "=============================="
echo "  EpicStaff - Remove Containers"
echo "=============================="
echo

# Get all container IDs with project name epicstaff
CONTAINERS=$(docker ps -a --filter "name=epicstaff" --format "{{.ID}}")

if [ -z "$CONTAINERS" ]; then
    echo "[INFO] No EpicStaff containers found."
else
    for c in $CONTAINERS; do
        echo "[INFO] Stopping container $c..."
        docker stop "$c" >/dev/null 2>&1
        echo "[INFO] Removing container $c..."
        docker rm "$c" >/dev/null 2>&1
    done
fi

echo "[OK] All EpicStaff containers removed."
