#!/usr/bin/env python3
"""Fail-closed, non-flashing firmware ZIP intake. Only operator-trusted hash."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import sys
import zipfile

MAX_ARCHIVE_BYTES = 512 * 1024 * 1024
MAX_FILES = 150
MAX_TOTAL_UNCOMPRESSED = 1024 * 1024 * 1024
MAX_MEMBER_BYTES = 256 * 1024 * 1024
MAX_RATIO = 200

def check_zip(source: Path, expected_sha256: str, destination: Path) -> dict:
    if not re.fullmatch(r"[0-9a-fA-F]{64}", expected_sha256):
        raise ValueError("Expected trusted SHA-256 must contain exactly 64 hex digits")
    if not source.is_file() or source.is_symlink():
        raise ValueError("Firmware ZIP must be a regular non-symlinked file")
    if source.stat().st_size > MAX_ARCHIVE_BYTES or source.stat().st_size == 0:
        raise ValueError("Firmware archive outside byte limits")
    actual = hashlib.sha256()
    with source.open("rb") as inp:
        for chunk in iter(lambda: inp.read(1024 * 1024), b""):
            actual.update(chunk)
    if actual.hexdigest().lower() != expected_sha256.lower():
        raise ValueError("Firmware SHA-256 does not match independently trusted value")
    if destination.exists() or destination.is_symlink():
        raise ValueError("Destination exists; refusing overwrite")

    validated = []
    seen = set()
    total = 0
    with zipfile.ZipFile(source) as archive:
        entries = archive.infolist()
        if not entries or len(entries) > MAX_FILES:
            raise ValueError("Archive file-count outside limits")
        for entry in entries:
            raw = entry.filename
            path = PurePosixPath(raw)
            if ("\\" in raw or "\x00" in raw or raw.startswith("/")
                    or ":" in raw or any(part in ("", ".", "..") for part in path.parts)
                    or path.is_absolute() or (entry.flag_bits & 0x1)):
                raise ValueError("Unsafe ZIP member path or encryption")
            mode = (entry.external_attr >> 16) & 0xFFFF
            filetype = stat.S_IFMT(mode)
            if filetype not in (0, stat.S_IFREG, stat.S_IFDIR):
                raise ValueError("Symlink/special ZIP member forbidden")
            normalized = str(path).rstrip("/")
            if normalized in seen:
                raise ValueError("Duplicate ZIP member")
            seen.add(normalized)
            if entry.file_size > MAX_MEMBER_BYTES:
                raise ValueError("ZIP member too large")
            if entry.file_size > max(entry.compress_size, 1) * MAX_RATIO:
                raise ValueError("Unreasonable ZIP compression ratio")
            total += entry.file_size
            if total > MAX_TOTAL_UNCOMPRESSED:
                raise ValueError("Excessive uncompressed archive size")
            validated.append((entry, path))
        bad_member = archive.testzip()
        if bad_member is not None:
            raise ValueError("Corrupt archive member: " + bad_member)

        # Target is new and created only after all validations succeed.
        destination.mkdir(parents=True, exist_ok=False, mode=0o700)
        try:
            for entry, relative in validated:
                target = destination.joinpath(*relative.parts)
                if entry.is_dir():
                    target.mkdir(parents=True, exist_ok=True, mode=0o700)
                    continue
                target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
                fd = os.open(target, flags, 0o600)
                with os.fdopen(fd, "wb") as output, archive.open(entry) as inp:
                    copied = 0
                    while True:
                        block = inp.read(1024 * 1024)
                        if not block:
                            break
                        copied += len(block)
                        if copied > entry.file_size:
                            raise ValueError("ZIP entry expanded beyond declared size")
                        output.write(block)
        except BaseException:
            # Keep partial extraction for forensic analysis; never claim success.
            raise
    return {"verified_sha256": actual.hexdigest(), "member_count": len(validated),
            "uncompressed_bytes": total, "destination": str(destination),
            "hardware_compatibility_verified": False, "flash_permitted": False}

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("zip", type=Path)
    parser.add_argument("--trusted-sha256", required=True,
                        help="SHA-256 obtained independently from authenticated OEM source")
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(check_zip(args.zip, args.trusted_sha256, args.output_dir), indent=2))
        return 0
    except (OSError, zipfile.BadZipFile, ValueError, RuntimeError) as exc:
        print("Firmware not accepted: " + str(exc), file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
