#!/bin/bash
set -e
REPO_URL="https://github.com/EpicStaff/EpicStaff.git"
REPO_DIR="EpicStaff"

function pause() {
    read -rp "Press Enter to continue..."
}

function clear_screen() {
    clear
}

function prepare_repo() {
    if [ ! -d "$REPO_DIR" ]; then
        echo "Repository not found. Cloning $REPO_URL ..."
        git clone "$REPO_URL" "$REPO_DIR" || { echo "Clone failed."; return 1; }
    fi
    pushd "$REPO_DIR" > /dev/null
    git fetch --all --tags
}

function update_program() {
    clear_screen
    [ ! -d "$REPO_DIR" ] && git clone "$REPO_URL" "$REPO_DIR"
    pushd "$REPO_DIR/run_program" > /dev/null
    ./update.sh
    popd > /dev/null
}

function run_program() {
    clear_screen
    [ ! -d "$REPO_DIR" ] && git clone "$REPO_URL" "$REPO_DIR"
    pushd "$REPO_DIR/run_program" > /dev/null
    ./run.sh
    popd > /dev/null
}

function stop_system() {
    clear_screen
    [ ! -d "$REPO_DIR" ] && git clone "$REPO_URL" "$REPO_DIR"
    pushd "$REPO_DIR/run_program" > /dev/null
    ./remove_containers.sh
    popd > /dev/null
    echo "System stopped."
    pause
}

function choose_version() {
    prepare_repo || return
    while true; do
        clear_screen
        echo "=============================="
        echo "   EpicStaff - Choose Version"
        echo "=============================="
        echo "1) Checkout by Tag"
        echo "2) Checkout by Branch"
        echo "3) Back"
        read -rp "Enter choice (1-3): " choice
        case "$choice" in
            1) choose_tag ;;
            2) choose_branch ;;
            3) break ;;
            *) echo "Invalid choice." ;;
        esac
    done
    popd > /dev/null
}

function choose_tag() {
    local tags=($(git tag --sort=-creatordate))
    local total=${#tags[@]}
    local page=0
    local page_size=10
    while true; do
        clear_screen
        echo "Select Tag (page $((page+1))):"
        local start=$((page*page_size))
        local end=$((start+page_size-1))
        [ $end -ge $total ] && end=$((total-1))
        for i in $(seq $start $end); do
            printf "%3d) %s\n" $((i+1)) "${tags[i]}"
        done
        echo "N) Next page"
        echo "P) Previous page"
        echo "B) Back"
        read -rp "Enter choice: " choice
        case "$choice" in
            [0-9]*)
                idx=$((choice-1))
                if [ "$idx" -ge 0 ] && [ "$idx" -lt "$total" ]; then
                    clear_screen
                    git checkout "${tags[idx]}"
                    echo "Switched to tag ${tags[idx]}"
                    pause
                    return
                else
                    echo "Invalid choice."
                    pause
                fi
                ;;
            [Nn]) ((page++)) ; [ $page -ge $(( (total+page_size-1)/page_size )) ] && ((page--)) ;;
            [Pp]) ((page--)) ; [ $page -lt 0 ] && ((page++)) ;;
            [Bb]) return ;;
            *) echo "Invalid choice." ; pause ;;
        esac
    done
}

function choose_branch() {
    local branches=($(git branch -r --sort=-committerdate | grep -v HEAD))
    local total=${#branches[@]}
    local page=0
    local page_size=10
    while true; do
        clear_screen
        echo "Select Branch (page $((page+1))):"
        local start=$((page*page_size))
        local end=$((start+page_size-1))
        [ $end -ge $total ] && end=$((total-1))
        for i in $(seq $start $end); do
            printf "%3d) %s\n" $((i+1)) "${branches[i]}"
        done
        echo "N) Next page"
        echo "P) Previous page"
        echo "B) Back"
        read -rp "Enter choice: " choice
        case "$choice" in
            [0-9]*)
                idx=$((choice-1))
                if [ "$idx" -ge 0 ] && [ "$idx" -lt "$total" ]; then
                    clear_screen
                    branch_name=$(echo "${branches[idx]}" | awk -F/ '{print $2}')
                    git checkout "$branch_name"
                    echo "Switched to branch $branch_name"
                    pause
                    return
                else
                    echo "Invalid choice."
                    pause
                fi
                ;;
            [Nn]) ((page++)) ; [ $page -ge $(( (total+page_size-1)/page_size )) ] && ((page--)) ;;
            [Pp]) ((page--)) ; [ $page -lt 0 ] && ((page++)) ;;
            [Bb]) return ;;
            *) echo "Invalid choice." ; pause ;;
        esac
    done
}

while true; do
    clear_screen
    echo "==============================="
    echo " EpicStaff Program Manager"
    echo "==============================="
    echo "1) Update program"
    echo "2) Run program"
    echo "3) Change version"
    echo "4) Stop system"
    echo "5) Exit"
    read -rp "Choose an option: " choice

    case "$choice" in
        1) update_program ;;
        2) run_program ;;
        3) choose_version ;;
        4) stop_system ;;
        5) exit 0 ;;
        *) echo "Invalid choice." ; pause ;;
    esac
done
