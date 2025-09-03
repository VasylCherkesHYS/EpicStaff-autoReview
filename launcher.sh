#!/bin/bash
# run_program.sh - Main program manager

REPO_URL="https://github.com/EpicStaff/EpicStaff.git"
REPO_DIR="EpicStaff"

show_menu() {
    clear
    echo "=============================="
    echo "EpicStaff Program Manager"
    echo "=============================="
    echo "1. Install program"
    echo "2. Run program"
    echo "3. Change version"
    echo "4. Stop system"
    echo "5. Exit"
    echo "=============================="
    read -p "Choose an option: " choice
}

update_program() {
    clear
    if [ ! -d "$REPO_DIR" ]; then
        echo "Cloning repository..."
        git clone "$REPO_URL" "$REPO_DIR"
    fi
    cd "$REPO_DIR/run_program"
    ./update.sh
    cd - > /dev/null
}

run_program() {
    clear
    if [ ! -d "$REPO_DIR" ]; then
        echo "Repository not found. Cloning..."
        git clone "$REPO_URL" "$REPO_DIR"
    fi
    cd "$REPO_DIR/run_program"
    ./run.sh
    cd - > /dev/null
}

change_version() {
    clear
    if [ ! -d "$REPO_DIR" ]; then
        echo "Repository not found. Cloning..."
        git clone "$REPO_URL" "$REPO_DIR"
    fi
    cd "$REPO_DIR"
    git fetch --all --tags

    while true; do
        clear
        echo "=============================="
        echo "   EpicStaff - Choose Version"
        echo "=============================="
        echo "1. Checkout by Tag"
        echo "2. Checkout by Branch"
        echo "3. Back"
        echo "=============================="
        read -p "Enter choice (1-3): " choice

        case $choice in
            1) choose_tag ;;
            2) choose_branch ;;
            3) cd - > /dev/null; return ;;
            *) continue ;;
        esac
    done
}

choose_tag() {
    local page=0
    local tags=($(git tag --sort=-creatordate))
    local total=${#tags[@]}
    
    while true; do
        clear
        echo "=============================="
        echo "   Select Tag (page $page)"
        echo "=============================="
        
        local start=$((page * 10))
        local end=$((start + 9))
        
        for ((i=$start; i<=end && i<total; i++)); do
            echo "$((i+1)). ${tags[$i]}"
        done
        
        echo "N. Next page"
        echo "P. Previous page"
        echo "B. Back"
        echo
        read -p "Enter choice: " choice
        
        case $choice in
            [Nn])
                if [ $((start + 10)) -lt $total ]; then
                    ((page++))
                fi
                ;;
            [Pp])
                if [ $page -gt 0 ]; then
                    ((page--))
                fi
                ;;
            [Bb])
                return
                ;;
            *)
                if [[ "$choice" =~ ^[0-9]+$ ]] && [ $((choice-1)) -ge 0 ] && [ $((choice-1)) -lt $total ]; then
                    local tag_index=$((choice-1))
                    clear
                    git checkout "${tags[$tag_index]}"
                    echo "Switched to tag ${tags[$tag_index]}"
                    read -p "Press Enter to continue..."
                    return
                fi
                ;;
        esac
    done
}

choose_branch() {
    local page=0
    local branches=($(git branch -r --sort=-committerdate | grep -v HEAD | sed 's/origin\///'))
    local total=${#branches[@]}
    
    while true; do
        clear
        echo "=============================="
        echo "   Select Branch (page $page)"
        echo "=============================="
        
        local start=$((page * 10))
        local end=$((start + 9))
        
        for ((i=$start; i<=end && i<total; i++)); do
            echo "$((i+1)). ${branches[$i]}"
        done
        
        echo "N. Next page"
        echo "P. Previous page"
        echo "B. Back"
        echo
        read -p "Enter choice: " choice
        
        case $choice in
            [Nn])
                if [ $((start + 10)) -lt $total ]; then
                    ((page++))
                fi
                ;;
            [Pp])
                if [ $page -gt 0 ]; then
                    ((page--))
                fi
                ;;
            [Bb])
                return
                ;;
            *)
                if [[ "$choice" =~ ^[0-9]+$ ]] && [ $((choice-1)) -ge 0 ] && [ $((choice-1)) -lt $total ]; then
                    local branch_index=$((choice-1))
                    clear
                    git checkout "${branches[$branch_index]}"
                    echo "Switched to branch ${branches[$branch_index]}"
                    read -p "Press Enter to continue..."
                    return
                fi
                ;;
        esac
    done
}

stop_system() {
    clear
    if [ ! -d "$REPO_DIR" ]; then
        echo "Repository not found. Cloning..."
        git clone "$REPO_URL" "$REPO_DIR"
    fi
    cd "$REPO_DIR/run_program"
    ./remove_containers.sh
    cd - > /dev/null
    echo "System stopped."
    read -p "Press Enter to continue..."
}

# Main loop
while true; do
    show_menu
    case $choice in
        1) update_program ;;
        2) run_program ;;
        3) change_version ;;
        4) stop_system ;;
        5) exit 0 ;;
        *) continue ;;
    esac
done