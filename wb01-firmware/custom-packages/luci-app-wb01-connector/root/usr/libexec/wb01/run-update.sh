#!/bin/sh
set -eu

# Package metadata refresh
opkg update

# Install available package upgrades
opkg list-upgradable | cut -f 1 -d ' ' | xargs -r opkg upgrade

# Firmware upgrades should be performed with attendedsysupgrade/sysupgrade.
logger -t wb01-update "Package update run completed"
