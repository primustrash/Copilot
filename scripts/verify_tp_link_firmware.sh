#!/usr/bin/env bash
set -euo pipefail

# Verifies and extracts a TP-Link firmware ZIP in a reproducible way.
# Usage:
#   ./scripts/verify_tp_link_firmware.sh <firmware_zip>

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <firmware_zip>" >&2
  exit 1
fi

ZIP_PATH="$1"
if [[ ! -f "$ZIP_PATH" ]]; then
  echo "File not found: $ZIP_PATH" >&2
  exit 1
fi

OUT_DIR="$(dirname "$ZIP_PATH")/extracted_$(basename "$ZIP_PATH" .zip)"
LOG_DIR="$(dirname "$ZIP_PATH")/verification_logs"
mkdir -p "$OUT_DIR" "$LOG_DIR"

SHA_FILE="$LOG_DIR/$(basename "$ZIP_PATH").sha256.txt"
LIST_FILE="$LOG_DIR/$(basename "$ZIP_PATH").contents.txt"

sha256sum "$ZIP_PATH" | tee "$SHA_FILE"
unzip -l "$ZIP_PATH" | tee "$LIST_FILE"
unzip -o "$ZIP_PATH" -d "$OUT_DIR" >/dev/null

# quick inventory of extracted files
find "$OUT_DIR" -maxdepth 2 -type f | sort

echo
echo "Verification artifacts:"
echo "- SHA256: $SHA_FILE"
echo "- Contents: $LIST_FILE"
echo "- Extracted to: $OUT_DIR"
