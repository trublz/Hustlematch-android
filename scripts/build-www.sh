#!/bin/bash
# Copies the HustleMatch web app source into www/ for Capacitor.
# The web app is the single source of truth — never edit www/ directly.
# Local layout:  ../hustlematch  (sibling of this project)
# CI layout:     ./hustlematch   (subfolder of the repo root)
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -d "$ROOT/../hustlematch" ]; then
  SRC="$ROOT/../hustlematch"
elif [ -d "$ROOT/hustlematch" ]; then
  SRC="$ROOT/hustlematch"
else
  echo "ERROR: web app source not found (looked in ../hustlematch and ./hustlematch)" >&2
  exit 1
fi
rm -rf "$ROOT/www"
mkdir -p "$ROOT/www"
cp "$SRC/index.html" "$ROOT/www/"
cp -r "$SRC/css" "$ROOT/www/"
cp -r "$SRC/js" "$ROOT/www/"
echo "www/ rebuilt from $SRC ($(du -sh "$ROOT/www" | cut -f1))"
