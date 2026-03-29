#!/bin/sh
set -eu

TARGET="$(uci -q get wb01-connector.backup.target || echo /mnt/usbshare/backups)"
RETAIN="$(uci -q get wb01-connector.backup.retain || echo 14)"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
ARCHIVE="${TARGET}/wb01-config-${STAMP}.tar.gz"

mkdir -p "${TARGET}"

tar -czf "${ARCHIVE}" /etc/config /etc/dropbear /etc/crontabs/root

# Retention policy
ls -1t "${TARGET}"/wb01-config-*.tar.gz 2>/dev/null | awk "NR>${RETAIN}" | xargs -r rm -f

logger -t wb01-backup "Backup written to ${ARCHIVE}"
