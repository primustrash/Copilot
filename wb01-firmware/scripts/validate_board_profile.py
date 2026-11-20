#!/usr/bin/env python3
"""Validate candidate build inputs; NOT a hardware or flash certification."""
import argparse
import json
import re
import sys
from pathlib import Path

ALLOWED_FIELDS = {
    "board_id", "soc", "hardware_revision", "ram_mib", "flash_mib",
    "openwrt_target", "openwrt_subtarget", "openwrt_profile",
    "original_firmware_sha256", "bootloader", "recovery_procedure"
}
IDENTIFIER = re.compile(r"^[A-Za-z0-9_.-]{1,64}$")

def validate(filename):
    path = Path(filename).resolve(strict=True)
    if not path.is_file() or path.stat().st_size > 16000:
        raise ValueError("Candidate hardware profile must be a small regular file")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or set(data) != ALLOWED_FIELDS:
        raise ValueError("Hardware evidence fields incomplete or unexpected")
    for field in ("board_id", "soc", "hardware_revision", "openwrt_target",
                  "openwrt_subtarget", "openwrt_profile", "bootloader"):
        if not isinstance(data[field], str) or not IDENTIFIER.fullmatch(data[field]):
            raise ValueError("Missing/invalid hardware identifier: " + field)
    for field in ("ram_mib", "flash_mib"):
        if type(data[field]) is not int or not 1 <= data[field] <= 65536:
            raise ValueError("Invalid hardware memory field: " + field)
    if not isinstance(data["original_firmware_sha256"], str) or not re.fullmatch(
        r"[a-fA-F0-9]{64}", data["original_firmware_sha256"]
    ):
        raise ValueError("Missing or malformed original firmware SHA-256")
    if not isinstance(data["recovery_procedure"], str) or not 10 <= len(data["recovery_procedure"]) <= 500:
        raise ValueError("Recovery procedure must be described")
    if data["openwrt_profile"].lower() in ("generic", "unknown", "default"):
        raise ValueError("Generic and unverified target profiles cannot be accepted")
    # The existing overlay is designed for one family; another family needs
    # a separate board-specific code and regulatory validation.
    if (data["openwrt_target"], data["openwrt_subtarget"]) != ("ramips", "mt76x8"):
        raise ValueError("Incompatible OpenWrt target: independent design required")
    return data

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("candidate_evidence_json")
    args = parser.parse_args()
    try:
        value = validate(args.candidate_evidence_json)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print("Board-profile preflight denied: " + str(exc), file=sys.stderr)
        return 1
    print(value["openwrt_target"], value["openwrt_subtarget"],
          value["openwrt_profile"])
    print("WARNING: Candidate profile checked; actual hardware compatibility "
          "and recovery have NOT been independently verified.", file=sys.stderr)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
