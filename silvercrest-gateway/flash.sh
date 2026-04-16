#!/bin/bash
# flash.sh — Flash the Silvercrest Gateway firmware
#
# Wraps the upstream flash scripts for convenient use after building with build.sh.
#
# Usage:
#   ./flash.sh --first-flash [--boot-ip <IP>]
#       First-time flash from bootloader prompt (serial required).
#       Gateway must show the <RealTek> prompt (ESC during power-on).
#
#   ./flash.sh --upgrade <GATEWAY_IP> [-y]
#       Upgrade over SSH from running Linux. Saves current config.
#       Use -y for fully unattended operation (firmware >= v2.0.0).
#
#   ./flash.sh --radio <GATEWAY_IP> [--mode ncp|rcp|otrcp|router]
#       Flash the EFR32 Zigbee/Thread radio firmware over SSH.
#       Default: NCP-UART-HW (EmberZNet 7.5.1) — for Zigbee2MQTT / ZHA.
#
# Options:
#   --boot-ip <IP>   Gateway IP in bootloader mode  (default: 192.168.1.6)
#   --output  <DIR>  Directory with built firmware   (default: ./output)
#   -h, --help       Show this help

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
UPSTREAM_DIR="${SCRIPT_DIR}/.upstream"
OUTPUT_DIR="${SCRIPT_DIR}/output"
BOOT_IP="192.168.1.6"

MODE=""
GATEWAY_IP=""
UNATTENDED=""
RADIO_MODE="ncp"

# ── argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --first-flash) MODE="first" ;;
        --upgrade)     shift; MODE="upgrade"; GATEWAY_IP="$1" ;;
        --radio)       shift; MODE="radio";   GATEWAY_IP="$1" ;;
        --mode)        shift; RADIO_MODE="$1" ;;
        --boot-ip)     shift; BOOT_IP="$1" ;;
        --output|-o)   shift; OUTPUT_DIR="$1" ;;
        -y)            UNATTENDED="-y" ;;
        -h|--help)
            grep '^#' "$0" | sed 's/^# \{0,1\}//' | sed -n '2,/^$/p'
            exit 0
            ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
    shift
done

if [ -z "$MODE" ]; then
    echo "Usage: $0 --first-flash | --upgrade <IP> | --radio <IP>" >&2
    echo "       $0 --help" >&2
    exit 1
fi

# ── verify upstream repo ──────────────────────────────────────────────────────
if [ ! -d "${UPSTREAM_DIR}/.git" ]; then
    echo "ERROR: Upstream repo not found at ${UPSTREAM_DIR}" >&2
    echo "  Run ./build.sh first to clone the repo and build the firmware." >&2
    exit 1
fi

# ── verify firmware exists ────────────────────────────────────────────────────
if [ "$MODE" != "radio" ] && [ ! -f "${OUTPUT_DIR}/fullflash.bin" ]; then
    echo "ERROR: fullflash.bin not found in ${OUTPUT_DIR}" >&2
    echo "  Run ./build.sh first to build the firmware." >&2
    exit 1
fi

# ── copy built fullflash.bin into the upstream directory ─────────────────────
if [ "$MODE" != "radio" ]; then
    cp "${OUTPUT_DIR}/fullflash.bin" "${UPSTREAM_DIR}/fullflash.bin"
fi

# ── flash ─────────────────────────────────────────────────────────────────────
case "$MODE" in

    first)
        echo ""
        echo "╔═══════════════════════════════════════════════════════════╗"
        echo "║   First-Flash: RTL8196E Linux System                      ║"
        echo "╚═══════════════════════════════════════════════════════════╝"
        echo ""
        echo "Requirements:"
        echo "  - USB-to-serial adapter (3.3V, 38400 8N1) connected to the gateway"
        echo "  - Gateway showing the <RealTek> bootloader prompt"
        echo "    (press ESC within 1 second of power-on)"
        echo "  - Ethernet cable between this PC and the gateway"
        echo "  - BOOT_IP=${BOOT_IP} is the gateway's IP in bootloader mode"
        echo ""
        cd "$UPSTREAM_DIR"
        # flash_install_rtl8196e.sh with no argument = first flash from bootloader
        BOOT_IP="$BOOT_IP" bash flash_install_rtl8196e.sh
        ;;

    upgrade)
        echo ""
        echo "╔═══════════════════════════════════════════════════════════╗"
        echo "║   Upgrade: RTL8196E Linux System over SSH                 ║"
        echo "╚═══════════════════════════════════════════════════════════╝"
        echo ""
        cd "$UPSTREAM_DIR"
        bash flash_install_rtl8196e.sh ${UNATTENDED} "$GATEWAY_IP"
        ;;

    radio)
        echo ""
        echo "╔═══════════════════════════════════════════════════════════╗"
        echo "║   Flash EFR32 Zigbee/Thread Radio Firmware                ║"
        echo "╚═══════════════════════════════════════════════════════════╝"
        echo ""
        echo "  Radio mode selected: ${RADIO_MODE}"
        echo "  Gateway IP: ${GATEWAY_IP}"
        echo ""
        cd "$UPSTREAM_DIR"
        # flash_efr32.sh is interactive (mode selection menu)
        # pre-select using RADIO_MODE env var if the upstream script supports it
        bash flash_efr32.sh "$GATEWAY_IP"
        ;;

esac

echo ""
echo "Flash complete."
echo ""
