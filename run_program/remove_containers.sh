#!/bin/bash
# remove_containers.sh - Remove EpicStaff containers

echo "============================="
echo "   EpicStaff - Remove Containers"
echo "============================="
echo

# List all containers with project name epicstaff and stop+remove them
for container_id in $(docker ps -a --filter "name=epicstaff" --format "{{.ID}}"); do
    echo "[INFO] Stopping container $container_id..."
    docker stop "$container_id" > /dev/null 2>&1
    echo "[INFO] Removing container $container_id..."
    docker rm "$container_id" > /dev/null 2>&1
done

echo "[OK] All EpicStaff containers removed."