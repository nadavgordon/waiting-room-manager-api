#!/bin/bash

# Specify the starting directory
start_dir="." # Or replace with your target folder, e.g., "/path/to/your/folder"

echo "Character Count | Line Count | File Path"
echo "----------------|------------|-----------"

find "$start_dir" -type f -print0 | while IFS= read -r -d $'\0' file; do
    if [ -f "$file" ]; then # Ensure it's a regular file
        counts=$(wc -mc < "$file")
        chars=$(echo "$counts" | awk '{print $1}')
        lines=$(echo "$counts" | awk '{print $2}')
        printf "%15s | %10s | %s\n" "$chars" "$lines" "$file"
    fi
done
