#!/bin/bash

set -e

CURRENT_VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')

echo "Current version: $CURRENT_VERSION"
echo "What type of release?"
echo "1) Patch (1.0.0 -> 1.0.1)"
echo "2) Minor (1.0.0 -> 1.1.0)"
echo "3) Major (1.0.0 -> 2.0.0)"
read -p "Enter choice (1-3): " choice

case $choice in
  1) NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{$NF=$NF+1;}1' OFS=.) ;;
  2) NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{$(NF-1)=$(NF-1)+1;$NF=0;}1' OFS=.) ;;
  3) NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{$1=$1+1;$2=0;$NF=0;}1' OFS=.) ;;
  *) echo "Invalid choice"; exit 1 ;;
esac

echo "New version: $NEW_VERSION"
read -p "Continue? (y/n): " confirm
[ "$confirm" = "y" ] || exit 1

sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" package.json

git add package.json
git commit -m "chore: bump version to $NEW_VERSION"
git tag "v$NEW_VERSION"

git push origin main
git push origin "v$NEW_VERSION"

echo "✓ Released v$NEW_VERSION"
echo "Workflow: https://github.com/jabezpauls/md-converter/actions"
