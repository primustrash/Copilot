include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-wb01-connector
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

LUCI_TITLE:=LuCI support for WB01 tunnel/storage connector
LUCI_DEPENDS:=+luci-base +luci-mod-admin-full +wireguard-tools +block-mount +kmod-fs-ext4 +samba4-server
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
