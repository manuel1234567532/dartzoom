#!/bin/bash

# DartZoom Build Script
# Erstellt obfuskierte Version im dist/ Ordner

# Farben für Output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎯 DartZoom Build Script${NC}"
echo "========================="

# Pfade
SRC_DIR="$(dirname "$0")"
DIST_DIR="$SRC_DIR/dist"

# dist Ordner erstellen/leeren
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

echo -e "${GREEN}📁 Kopiere statische Dateien...${NC}"
cp "$SRC_DIR/manifest.json" "$DIST_DIR/"
cp "$SRC_DIR/popup.html" "$DIST_DIR/"
cp "$SRC_DIR/popup.css" "$DIST_DIR/"
cp "$SRC_DIR"/*.png "$DIST_DIR/" 2>/dev/null

echo -e "${GREEN}🔐 Obfuskiere JavaScript...${NC}"

# JavaScript Dateien obfuskieren
for file in background.js popup.js pageScript.js injector.js; do
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

echo -e "${GREEN}📦 Erstelle ZIP...${NC}"
cd "$DIST_DIR"
zip -r ../dartzoom-release.zip . -x "*.DS_Store"
cd ..

echo ""
echo -e "${GREEN}✅ Build fertig!${NC}"
echo ""
echo "Ordner-Struktur:"
echo "  dartzoom/           ← Original (Entwicklung)"
echo "  dartzoom/dist/      ← Obfuskiert (Release)"
echo "  dartzoom-release.zip ← Fertige Extension"
echo ""
ls -lh "$SRC_DIR/dartzoom-release.zip" 2>/dev/null || ls -lh dartzoom-release.zip
