#!/usr/bin/env sh
set -eu

# Sicheres First-Boot-Setup für Router-/Repeater-Betrieb
# - SSH aktiv
# - Root Passwort MUSS gesetzt werden
# - LuCI verfügbar

if ! command -v uci >/dev/null 2>&1; then
  echo "Dieses Skript ist für OpenWrt/UCI gedacht." >&2
  exit 1
fi

# SSH aktivieren
uci set dropbear.@dropbear[0].enable='1'
uci set dropbear.@dropbear[0].Interface='lan'
uci commit dropbear
/etc/init.d/dropbear enable
/etc/init.d/dropbear restart

# LuCI/uhttpd aktivieren (falls vorhanden)
if [ -x /etc/init.d/uhttpd ]; then
  /etc/init.d/uhttpd enable
  /etc/init.d/uhttpd restart
fi

# Root-Passwort prüfen
if [ -z "$(awk -F: '$1=="root" {print $2}' /etc/shadow 2>/dev/null || true)" ] || \
   [ "$(awk -F: '$1=="root" {print $2}' /etc/shadow 2>/dev/null || true)" = "!" ]; then
  echo "WARNUNG: root hat noch kein gültiges Passwort. Bitte jetzt setzen:" >&2
  passwd
fi

echo "Firstboot-Hardening abgeschlossen."
