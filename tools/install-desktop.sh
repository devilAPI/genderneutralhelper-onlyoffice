#!/bin/sh
# Copies the plugin into OnlyOffice Desktop Editors for the current user.
set -eu
DEST="$HOME/.local/share/onlyoffice/desktopeditors/sdkjs-plugins/{6F1C2A9E-3B7D-4E58-9A41-C2D07B5E8F13}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
rm -rf "$DEST"
mkdir -p "$DEST"
for item in config.json index.html resources scripts translations; do
  if [ -e "$SRC/$item" ]; then
    cp -r "$SRC/$item" "$DEST/"
  fi
done
echo "Installed to $DEST. Restart OnlyOffice Desktop Editors."
