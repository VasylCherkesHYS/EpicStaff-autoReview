#!/bin/sh
# run_program_posix.sh - Main program manager (POSIX compatible)

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
    echo "4. Set savefile path"
    echo "5. Stop system"
    echo "6. Exit"
    echo "=============================="
    printf "Choose an option: "
    read choice
}

update_program() {
    
    
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
        printf "Enter choice (1-3): "
        read choice

        case $choice in
            1) choose_tag ;;
            2) choose_branch ;;
            3) cd - > /dev/null; return ;;
            *) continue ;;
        esac
    done
}

choose_tag() {
    page=0
    per_page=10
    
    while true; do
        clear
        echo "=============================="
        echo "   Select Tag (page $page)"
        echo "=============================="
        
        # Get tags and show current page
        git tag --sort=-creatordate | awk -v start=$((page*per_page+1)) -v end=$((page*per_page+per_page)) '
        NR >= start && NR <= end { print NR". "$0 }
        END { print "TOTAL="NR }
        ' > /tmp/tags_$$
        
        total=$(grep "TOTAL=" /tmp/tags_$$ | cut -d= -f2)
        grep -v "TOTAL=" /tmp/tags_$$
        
        echo "N. Next page"
        echo "P. Previous page"
        echo "B. Back"
        echo
        printf "Enter choice: "
        read choice
        
        case $choice in
            [Nn]|[Nn]ext)
                if [ $((page*per_page+per_page)) -lt $total ]; then
                    page=$((page+1))
                fi
                ;;
            [Pp]|[Pp]rev*)
                if [ $page -gt 0 ]; then
                    page=$((page-1))
                fi
                ;;
            [Bb]|[Bb]ack)
                rm -f /tmp/tags_$$
                return
                ;;
            *)
                if echo "$choice" | grep -q '^[0-9][0-9]*$'; then
                    tag=$(git tag --sort=-creatordate | sed -n "${choice}p")
                    if [ -n "$tag" ]; then
                        clear
                        git checkout "$tag"
                        echo "Switched to tag $tag"
                        printf "Press Enter to continue..."
                        read dummy
                        rm -f /tmp/tags_$$
                        return
                    fi
                fi
                ;;
        esac
    done
}

choose_branch() {
    page=0
    per_page=10
    
    while true; do
        clear
        echo "=============================="
        echo "   Select Branch (page $page)"
        echo "=============================="
        
        # Get remote branches and show current page
        git branch -r --sort=-committerdate | grep -v HEAD | sed 's/origin\///' | awk -v start=$((page*per_page+1)) -v end=$((page*per_page+per_page)) '
        NR >= start && NR <= end { print NR". "$0 }
        END { print "TOTAL="NR }
        ' > /tmp/branches_$$
        
        total=$(grep "TOTAL=" /tmp/branches_$$ | cut -d= -f2)
        grep -v "TOTAL=" /tmp/branches_$$
        
        echo "N. Next page"
        echo "P. Previous page"
        echo "B. Back"
        echo
        printf "Enter choice: "
        read choice
        
        case $choice in
            [Nn]|[Nn]ext)
                if [ $((page*per_page+per_page)) -lt $total ]; then
                    page=$((page+1))
                fi
                ;;
            [Pp]|[Pp]rev*)
                if [ $page -gt 0 ]; then
                    page=$((page-1))
                fi
                ;;
            [Bb]|[Bb]ack)
                rm -f /tmp/branches_$$
                return
                ;;
            *)
                if echo "$choice" | grep -q '^[0-9][0-9]*$'; then
                    branch=$(git branch -r --sort=-committerdate | grep -v HEAD | sed 's/origin\///' | sed -n "${choice}p" | awk '{print $1}')
                    if [ -n "$branch" ]; then
                        clear
                        git checkout "$branch"
                        echo "Switched to branch $branch"
                        printf "Press Enter to continue..."
                        read dummy
                        rm -f /tmp/branches_$$
                        return
                    fi
                fi
                ;;
        esac
    done
}

set_savefile_path() {
    clear
    if [ ! -d "$REPO_DIR" ]; then
        echo "Repository not found. Cloning..."
        git clone "$REPO_URL" "$REPO_DIR"
    fi
    cd "$REPO_DIR/run_program"
    ./merge_env.sh
    cd - > /dev/null
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
    printf "Press Enter to continue..."
    read dummy
}

# Main loop
while true; do
    show_menu
    case $choice in
        1) update_program ;;
        2) run_program ;;
        3) change_version ;;
        4) set_savefile_path ;;
        5) stop_system ;;
        6) exit 0 ;;
        *) continue ;;
    esac
done