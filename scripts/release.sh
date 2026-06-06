#!/bin/bash

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get current version
CURRENT_VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')

echo -e "${YELLOW}Current version: ${CURRENT_VERSION}${NC}"
echo "What type of release?"
echo "1) Patch (1.0.0 -> 1.0.1)"
echo "2) Minor (1.0.0 -> 1.1.0)"
echo "3) Major (1.0.0 -> 2.0.0)"
echo "4) Custom version"
read -p "Enter choice (1-4): " choice

case $choice in
  1)
    NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{$NF=$NF+1;}1' OFS=.)
    ;;
  2)
    NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{$(NF-1)=$(NF-1)+1;$NF=0;}1' OFS=.)
    ;;
  3)
    NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{$1=$1+1;$2=0;$NF=0;}1' OFS=.)
    ;;
  4)
    read -p "Enter new version: " NEW_VERSION
    ;;
  *)
    echo -e "${RED}Invalid choice${NC}"
    exit 1
    ;;
esac

echo -e "${YELLOW}New version: ${NEW_VERSION}${NC}"
read -p "Continue? (y/n): " confirm

if [ "$confirm" != "y" ]; then
  echo -e "${RED}Cancelled${NC}"
  exit 1
fi

# Update version in package.json
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" package.json

# Commit version bump
git add package.json
git commit -m "chore: bump version to $NEW_VERSION"

# Create tag
git tag "v$NEW_VERSION"

echo -e "${GREEN}Version bumped to $NEW_VERSION${NC}"
echo -e "${YELLOW}Pushing changes and tag...${NC}"

# Push changes and tag
git push origin main
git push origin "v$NEW_VERSION"

echo -e "${GREEN}✓ Release v$NEW_VERSION published!${NC}"
echo -e "${YELLOW}Monitor the GitHub Actions workflow at:${NC}"
echo "https://github.com/jabezpauls/md-converter/actions"
