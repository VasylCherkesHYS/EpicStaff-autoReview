#!/bin/bash
# merge_env.sh - Merge environment files

SRC_ENV="../src/.env"
DEST_DIR="$HOME/.config/EpicStaff"
DEST_ENV="$DEST_DIR/.env"

echo "==============================="
echo "   EpicStaff - Sync .env"
echo "==============================="
echo

if [ ! -f "$SRC_ENV" ]; then
    echo "[ERROR] Source .env file \"$SRC_ENV\" not found!"
    exit 1
fi

if [ ! -d "$DEST_DIR" ]; then
    mkdir -p "$DEST_DIR"
    echo "[INFO] Created directory $DEST_DIR"
fi

if [ ! -f "$DEST_ENV" ]; then
    echo "[INFO] Creating new .env in $DEST_DIR..."
    touch "$DEST_ENV"
fi

echo "[INFO] Merging with existing .env..."
echo

# Create temporary files
TEMP_DEST=$(mktemp)
TEMP_SRC=$(mktemp)

# Load existing DEST_ENV, ignore comments and empty lines
grep -v '^#' "$DEST_ENV" | grep -v '^$' > "$TEMP_DEST" 2>/dev/null || true

# Process source env, ignore comments and empty lines
grep -v '^#' "$SRC_ENV" | grep -v '^$' > "$TEMP_SRC" 2>/dev/null || true

# Create associative array for existing values
declare -A dest_values
while IFS='=' read -r key value; do
    if [ -n "$key" ]; then
        dest_values["$key"]="$value"
    fi
done < "$TEMP_DEST"

# Process source values
TEMP_NEW=$(mktemp)
cp "$DEST_ENV" "$TEMP_NEW"

while IFS='=' read -r key value; do
    if [ -n "$key" ]; then
        if [ -n "${dest_values[$key]+set}" ]; then
            # Key exists, check if value differs
            current="${dest_values[$key]}"
            if [ "$current" != "$value" ]; then
                echo "[INFO] Key $key exists with different value."
                echo "       Current: $current"
                echo "       Source : $value"
                echo
                echo "Choose an option for $key:"
                echo "   1. Keep current value            $current"
                echo "   2. Use new value from src/.env   $value [default]"
                read -p "Enter choice (1-2, default 2): " choice

                if [ "$choice" = "1" ]; then
                    echo "[INFO] Keeping existing value for $key"
                else
                    # Replace the line
                    sed -i.bak "s/^$key=.*/$key=$value/" "$TEMP_NEW"
                    echo "[INFO] Updated $key to $value"
                fi
            fi
        else
            # Key not found, add it
            echo "[INFO] Adding new $key=$value"
            echo "$key=$value" >> "$TEMP_NEW"
        fi
    fi
done < "$TEMP_SRC"

# Replace original file
mv "$TEMP_NEW" "$DEST_ENV"

# Cleanup
rm -f "$TEMP_DEST" "$TEMP_SRC"

echo
echo "[INFO] Merge complete."