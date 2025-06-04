#!/bin/bash

# Specify the starting directory
start_dir="." # Or replace with your target folder, e.g., "/path/to/your/folder"

echo "Char Count | Line Count | File Path"
echo "-----------|------------|-----------"

# Function to process a single file
process_file() {
    local file_path="$1"
    if [ -f "$file_path" ]; then # Ensure it's a regular file
        chars=$(wc -m < "$file_path" | mawk '{print $1}')
        lines=$(wc -l < "$file_path" | mawk '{print $1}')
        printf "%10s | %10s | %s\n" "$chars" "$lines" "$file_path"
    fi
}

# Check if fd is available
if command -v fd &> /dev/null; then
    # echo "Using fd command (respects .gitignore and hidden files by default)."
    # fd --type f: find only files
    # --print0: print null-separated
    # . "$start_dir": search in $start_dir (the initial dot is for fd's pattern argument, which we don't need here)
    fd --type f --print0 . "$start_dir" | while IFS= read -r -d $'\0' file; do
        process_file "$file"
    done
# Fallback to find if fd is not available, but git is
elif command -v git &> /dev/null; then
    # echo "fd command not found. Using find with git to respect .gitignore."
    # Use git check-ignore to skip ignored files, and exclude .git directory
    find "$start_dir" -type f -not -path '*/.git/*' -print0 | while IFS= read -r -d $'\0' file; do
        # git check-ignore -q --no-index "$file" returns 0 if ignored, 1 if not
        if ! git check-ignore -q --no-index "$file"; then
            process_file "$file"
        fi
    done
# Fallback to find if neither fd nor git is available
else
    # echo "fd and git commands not found. Using find (will only skip .git folder, not .gitignore patterns)."
    find "$start_dir" -type f -not -path '*/.git/*' -print0 | while IFS= read -r -d $'\0' file; do
        process_file "$file"
    done
fi
