#!/usr/bin/env bash
set -euo pipefail

OPENWRT_VERSION="v23.05.5"
TARGET="ramips"
SUBTARGET="mt76x8"
PROFILE="generic"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_DIR="${ROOT_DIR}/openwrt"

if [[ ! -d "${WORK_DIR}" ]]; then
  git clone --branch "${OPENWRT_VERSION}" --depth 1 https://github.com/openwrt/openwrt.git "${WORK_DIR}"
fi

cd "${WORK_DIR}"

./scripts/feeds update -a
./scripts/feeds install -a

# Inject custom LuCI app/package for WB01 connector UI
mkdir -p package/wb01
rm -rf package/wb01/luci-app-wb01-connector
cp -a "${ROOT_DIR}/custom-packages/luci-app-wb01-connector" package/wb01/

cat > .config <<CFG
CONFIG_TARGET_${TARGET}=y
CONFIG_TARGET_${TARGET}_${SUBTARGET}=y
CONFIG_TARGET_${TARGET}_${SUBTARGET}_${PROFILE}=y
CONFIG_PACKAGE_luci=y
CONFIG_PACKAGE_luci-ssl=uhttpd
CONFIG_PACKAGE_luci-app-firewall=y
CONFIG_PACKAGE_luci-app-wireguard=y
CONFIG_PACKAGE_luci-app-sqm=y
CONFIG_PACKAGE_luci-app-ddns=y
CONFIG_PACKAGE_luci-app-watchcat=y
CONFIG_PACKAGE_luci-app-samba4=y
CONFIG_PACKAGE_luci-app-attendedsysupgrade=y
CONFIG_PACKAGE_luci-app-wb01-connector=y
CONFIG_PACKAGE_wireguard-tools=y
CONFIG_PACKAGE_kmod-wireguard=y
CONFIG_PACKAGE_ca-bundle=y
CONFIG_PACKAGE_ca-certificates=y
CONFIG_PACKAGE_tcpdump=y
CONFIG_PACKAGE_htop=y
CONFIG_PACKAGE_nftables=y
CONFIG_PACKAGE_iptables-nft=y
CONFIG_PACKAGE_kmod-usb2=y
CONFIG_PACKAGE_kmod-usb-ohci=y
CONFIG_PACKAGE_kmod-usb-storage=y
CONFIG_PACKAGE_kmod-usb-printer=y
CONFIG_PACKAGE_kmod-fs-ext4=y
CONFIG_PACKAGE_block-mount=y
CONFIG_PACKAGE_samba4-server=y
CONFIG_PACKAGE_wsdd2=y
CONFIG_PACKAGE_attendedsysupgrade-common=y
CONFIG_PACKAGE_urngd=y
CFG

make defconfig

rm -rf files
mkdir -p files
cp -a "${ROOT_DIR}/files/." files/

# Download + Build
make -j"$(nproc)" download
make -j"$(nproc)"

echo "Build abgeschlossen. Images unter: ${WORK_DIR}/bin/targets/${TARGET}/${SUBTARGET}/"
