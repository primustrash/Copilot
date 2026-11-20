#!/usr/bin/env bash
set -euo pipefail
# No extraction/flash without a digest obtained independently from the OEM.
# Usage: verify_tp_link_firmware.sh firmware.zip TRUSTED_SHA256 output_dir
if [[ $# -ne 3 ]]; then
  printf '%s\n' "Usage: $0 <firmware.zip> <independent_trusted_sha256> <new_output_dir>" >&2
  exit 2
fi
ROOT="$(cd "$(dirname "$0")" && pwd)"
exec python3 "$ROOT/safe_verify_firmware_zip.py" "$1" \
  --trusted-sha256 "$2" --output-dir "$3"
