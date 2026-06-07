#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

# Read version from manifest.json
VERSION=$(grep '"version"' "$ROOT/manifest.json" | sed 's/.*"version": *"\([^"]*\)".*/\1/')
if [[ -z "$VERSION" ]]; then
  echo "ERROR: Could not read version from manifest.json" >&2
  exit 1
fi

# Validate required icon sizes exist
for size in 16 48 128; do
  if [[ ! -f "$ROOT/icons/icon-${size}.png" ]]; then
    echo "ERROR: Missing required icon: icons/icon-${size}.png" >&2
    echo "Run: sips -z ${size} ${size} icon.png --out icons/icon-${size}.png" >&2
    exit 1
  fi
done

mkdir -p "$ROOT/dist"

OUTPUT="$ROOT/dist/textforge-${VERSION}-webstore.zip"

# Remove old zip if it exists
rm -f "$OUTPUT"

# Create zip from the root, with exclusions
cd "$ROOT"
zip -r "$OUTPUT" . \
  --exclude ".git/*" \
  --exclude ".github/*" \
  --exclude ".claude/*" \
  --exclude "CLAUDE.md" \
  --exclude "dist/*" \
  --exclude "scripts/*" \
  --exclude ".gitignore" \
  --exclude ".DS_Store" \
  --exclude "*.zip" \
  --exclude "README.md"

echo ""
echo "✅ Created: $OUTPUT"
echo "   Size: $(du -sh "$OUTPUT" | cut -f1)"
echo ""
echo "Next steps:"
echo "  1. Upload to Chrome Web Store Developer Console:"
echo "     https://chrome.google.com/webstore/devconsole"
echo "  2. Fill in listing details (description, screenshots, privacy policy URL)"
echo "  3. Submit for review (1-3 business days)"
