#!/bin/bash
# run.sh - Run the EpicStaff project

echo "============================="
echo "   EpicStaff - Run Project"
echo "============================="
echo

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run remove_containers first
"$SCRIPT_DIR/remove_containers.sh"

# Change to src directory
cd "$SCRIPT_DIR/../src"

# Start containers in detached mode
docker compose --project-name "epicstaff" up -d

echo "[OK] EpicStaff is running."
read -p "Press Enter to continue..."