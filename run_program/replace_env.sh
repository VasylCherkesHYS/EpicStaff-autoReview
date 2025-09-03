#!/bin/bash
# replace_env.sh - Replace src/.env with stored version

SRC_ENV="../src/.env"
DEST_DIR="$HOME/.config/EpicStaff"
DEST_ENV="$DEST_DIR/.env"

echo "==============================="
echo "   EpicStaff - Replace src/.env"
echo "==============================="
echo

if [ ! -f "$DEST_ENV" ]; then
    echo "[ERROR] .env not found in $DEST_DIR"
    read -p "Press Enter to continue..."
    exit 1
fi

echo "[INFO] Replacing $SRC_ENV with $DEST_ENV..."
cp "$DEST_ENV" "$SRC_ENV"
echo "[INFO] Replacement complete."
read -p "Press Enter to continue..."