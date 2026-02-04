#!/bin/bash

# DartControl Build Script
# Creates obfuscated version in dist/ folder

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎮 DartControl Build Script${NC}"
echo "=============================="

# Paths
SRC_DIR="$(dirname "$0")"
DIST_DIR="$SRC_DIR/dist"

# Create/clear dist folder
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

echo -e "${GREEN}📁 Copying static files...${NC}"
cp "$SRC_DIR/manifest.json" "$DIST_DIR/"
cp "$SRC_DIR/popup.html" "$DIST_DIR/"
cp "$SRC_DIR/popup.css" "$DIST_DIR/"
cp "$SRC_DIR/auth.html" "$DIST_DIR/"
cp "$SRC_DIR/auth.css" "$DIST_DIR/"
cp "$SRC_DIR"/*.png "$DIST_DIR/" 2>/dev/null

echo -e "${GREEN}🔐 Obfuscating JavaScript...${NC}"

# Obfuscate JavaScript files
for file in background.js popup.js auth.js pageScript.js injector.js; do
  if [ -f "$SRC_DIR/$file" ]; then
    echo "  → $file"
    npx javascript-obfuscator "$SRC_DIR/$file" \
      --output "$DIST_DIR/$file" \
      --compact true \
      --control-flow-flattening true \
      --control-flow-flattening-threshold 0.7 \
      --dead-code-injection true \
      --dead-code-injection-threshold 0.3 \
      --string-array true \
      --string-array-encoding base64 \
      --string-array-threshold 0.75 \
      --split-strings true \
      --split-strings-chunk-length 10 \
      2>/dev/null
  fi
done

echo -e "${GREEN}📦 Creating ZIP...${NC}"
cd "$DIST_DIR"
zip -r ../dartcontrol-release.zip . -x "*.DS_Store"
cd ..

echo ""
echo -e "${GREEN}✅ Build complete!${NC}"
echo ""
echo "Folder structure:"
echo "  dartcontrol/              ← Original (Development)"
echo "  dartcontrol/dist/         ← Obfuscated (Release)"
echo "  dartcontrol-release.zip   ← Ready Extension"
echo ""
ls -lh "$SRC_DIR/dartcontrol-release.zip" 2>/dev/null || ls -lh dartcontrol-release.zip