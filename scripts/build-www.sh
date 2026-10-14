#!/bin/bash
# Copies the HustleMatch web app source into www/ for Capacitor.
# The web app in ../hustlematch is the single source of truth — never edit www/ directly.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/../hustlematch"
rm -rf "$ROOT/www"
mkdir -p "$ROOT/www"
cp "$SRC/index.html" "$ROOT/www/"
cp -r "$SRC/css" "$ROOT/www/"
cp -r "$SRC/js" "$ROOT/www/"
echo "www/ rebuilt from ../hustlematch ($(du -sh "$ROOT/www" | cut -f1))"
