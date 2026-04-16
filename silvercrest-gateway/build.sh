#!/bin/bash
# build.sh — All-in-One Firmware Builder for Lidl Silvercrest Zigbee Gateway
#
# Clones jnilo1/hacking-lidl-silvercrest-gateway, builds the complete firmware
# inside Docker, and produces two ready-to-flash files in ./output/:
#
#   fullflash.bin           — 16 MiB RTL8196E Linux system image
#   ncp-uart-hw-7.5.1.gbl  — EFR32 Zigbee NCP radio firmware (EmberZNet 7.5.1)
#
# The Docker image is built once (~45 min on first run; subsequent runs are fast).
# To rebuild natively without Docker, use --skip-docker (Ubuntu 22.04 only).
#
# Usage:
#   ./build.sh [OPTIONS]
#
# Options:
#   --net-mode   static|dhcp      Network mode for the gateway (default: dhcp)
#   --ip         <IP>             Static IP address     (default: 192.168.1.88)
#   --netmask    <MASK>           Netmask               (default: 255.255.255.0)
#   --gateway    <GW>             Default gateway       (default: 192.168.1.1)
#   --radio-mode zigbee|thread    Radio mode            (default: zigbee)
#   --no-cache                    Force rebuild of Docker image from scratch
#   --skip-docker                 Build natively (Ubuntu 22.04, must have run
#                                 1-Build-Environment/install_deps.sh first)
#   --output|-o  <DIR>            Output directory      (default: ./output)
#   -h, --help                    Show this help
#
# After building, use flash.sh to flash the firmware to the gateway.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
UPSTREAM_REPO="https://github.com/jnilo1/hacking-lidl-silvercrest-gateway.git"
UPSTREAM_DIR="${SCRIPT_DIR}/.upstream"
OUTPUT_DIR="${SCRIPT_DIR}/output"
IMAGE_NAME="silvercrest-gateway-builder"

NET_MODE="dhcp"
IPADDR="192.168.1.88"
NETMASK="255.255.255.0"
GATEWAY="192.168.1.1"
RADIO_MODE="zigbee"
NO_CACHE=""
SKIP_DOCKER=0

# ── argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --net-mode)    shift; NET_MODE="$1" ;;
        --ip)          shift; IPADDR="$1" ;;
        --netmask)     shift; NETMASK="$1" ;;
        --gateway)     shift; GATEWAY="$1" ;;
        --radio-mode)  shift; RADIO_MODE="$1" ;;
        --no-cache)    NO_CACHE="--no-cache" ;;
        --skip-docker) SKIP_DOCKER=1 ;;
        --output|-o)   shift; OUTPUT_DIR="$1" ;;
        -h|--help)
            sed -n '2,27p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
    shift
done

mkdir -p "$OUTPUT_DIR"

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  Silvercrest Zigbee Gateway — All-in-One Firmware Builder ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
if [ "$NET_MODE" = "static" ]; then
    echo "  Network : static — ${IPADDR} / ${NETMASK} via ${GATEWAY}"
else
    echo "  Network : dhcp"
fi
echo "  Radio   : ${RADIO_MODE}"
echo "  Output  : ${OUTPUT_DIR}"
echo ""

# ── clone / update upstream repo ─────────────────────────────────────────────
if [ -d "${UPSTREAM_DIR}/.git" ]; then
    echo "→ Updating upstream repo..."
    git -C "$UPSTREAM_DIR" pull --ff-only --quiet
else
    echo "→ Cloning upstream repo (jnilo1/hacking-lidl-silvercrest-gateway)..."
    git clone --depth 1 "$UPSTREAM_REPO" "$UPSTREAM_DIR"
fi
echo ""

# ── Docker build ──────────────────────────────────────────────────────────────
if [ "$SKIP_DOCKER" -eq 0 ]; then
    if ! command -v docker >/dev/null 2>&1; then
        echo "ERROR: Docker not found." >&2
        echo "  Install: https://docs.docker.com/engine/install/" >&2
        echo "  Or use --skip-docker for a native build (Ubuntu 22.04 only)." >&2
        exit 1
    fi

    UPSTREAM_DOCKERFILE="${UPSTREAM_DIR}/1-Build-Environment/Dockerfile"
    BUILD_CTX="${UPSTREAM_DIR}/1-Build-Environment"

    # Build the upstream image only if it doesn't already exist or --no-cache is set
    if [ -n "$NO_CACHE" ] || ! docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
        echo "→ Building Docker image '${IMAGE_NAME}' (first run ~45 min)..."
        docker build ${NO_CACHE} \
            -t "$IMAGE_NAME" \
            -f "$UPSTREAM_DOCKERFILE" \
            "$BUILD_CTX"
        echo ""
    else
        echo "→ Docker image '${IMAGE_NAME}' already exists — skipping rebuild."
        echo "   (use --no-cache to force a rebuild)"
        echo ""
    fi

    echo "→ Building firmware inside Docker..."
    echo ""
    docker run --rm \
        --user builder \
        -e NET_MODE="$NET_MODE" \
        -e IPADDR="$IPADDR" \
        -e NETMASK="$NETMASK" \
        -e GATEWAY="$GATEWAY" \
        -e RADIO_MODE="$RADIO_MODE" \
        -v "${UPSTREAM_DIR}:/workspace" \
        -v "${OUTPUT_DIR}:/output" \
        "$IMAGE_NAME" \
        bash -c "
            set -euo pipefail
            cd /workspace

            # Build rootfs and assemble fullflash.bin (non-interactive)
            NET_MODE=\${NET_MODE} RADIO_MODE=\${RADIO_MODE} \
            IPADDR=\${IPADDR} NETMASK=\${NETMASK} GATEWAY=\${GATEWAY} \
            bash build_fullflash.sh -q

            # Copy outputs
            cp fullflash.bin /output/fullflash.bin
            echo 'fullflash.bin copied to /output/'

            # Copy pre-built Zigbee NCP firmware
            NCP=/workspace/2-Zigbee-Radio-Silabs-EFR32/24-NCP-UART-HW/firmware/ncp-uart-hw-7.5.1.gbl
            if [ -f \"\$NCP\" ]; then
                cp \"\$NCP\" /output/
                echo 'ncp-uart-hw-7.5.1.gbl copied to /output/'
            fi
        "

# ── Native build ──────────────────────────────────────────────────────────────
else
    echo "→ Building natively..."
    echo ""

    if [ ! -d "$UPSTREAM_DIR" ]; then
        echo "ERROR: Upstream repo not found at ${UPSTREAM_DIR}" >&2
        exit 1
    fi

    # Verify required tools
    for tool in mksquashfs mkfs.jffs2 fakeroot gcc; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            echo "ERROR: '${tool}' not found." >&2
            echo "  Run: sudo ${UPSTREAM_DIR}/1-Build-Environment/install_deps.sh" >&2
            exit 1
        fi
    done

    cd "$UPSTREAM_DIR"
    NET_MODE="$NET_MODE" RADIO_MODE="$RADIO_MODE" \
    IPADDR="$IPADDR" NETMASK="$NETMASK" GATEWAY="$GATEWAY" \
    bash build_fullflash.sh -q

    cp fullflash.bin "${OUTPUT_DIR}/fullflash.bin"

    NCP="2-Zigbee-Radio-Silabs-EFR32/24-NCP-UART-HW/firmware/ncp-uart-hw-7.5.1.gbl"
    if [ -f "$NCP" ]; then
        cp "$NCP" "${OUTPUT_DIR}/"
    fi
fi

# ── summary ───────────────────────────────────────────────────────────────────
echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                    BUILD COMPLETE                         ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

OK=0
if [ -f "${OUTPUT_DIR}/fullflash.bin" ]; then
    SZ=$(du -h "${OUTPUT_DIR}/fullflash.bin" | cut -f1)
    MD=$(md5sum "${OUTPUT_DIR}/fullflash.bin" | awk '{print $1}')
    echo "  ✓ fullflash.bin         ${SZ}  md5: ${MD}"
    OK=1
else
    echo "  ✗ fullflash.bin not found — build failed?" >&2
fi

if [ -f "${OUTPUT_DIR}/ncp-uart-hw-7.5.1.gbl" ]; then
    SZ=$(du -h "${OUTPUT_DIR}/ncp-uart-hw-7.5.1.gbl" | cut -f1)
    echo "  ✓ ncp-uart-hw-7.5.1.gbl  ${SZ}"
fi

echo ""
[ "$OK" -eq 0 ] && exit 1

echo "  Flash the firmware:"
echo "    Step 1 (Linux):  ./flash.sh --first-flash"
echo "                     (gateway must be at the <RealTek> serial prompt)"
echo ""
echo "    Step 2 (Zigbee): ./flash.sh --radio <GATEWAY_IP>"
echo "                     (once Linux is running, SSH reachable)"
echo ""
