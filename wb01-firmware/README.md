# Custom Firmware (WB01 / Creality Box) – Secure Cloud↔Heimnetz + USB Storage Connector

Diese Vorlage erstellt eine **OpenWrt-basierte Firmware** für WB01, die als:

1. sicherer **Tunnel/Connector** zwischen Cloud und Heimnetz,
2. optionaler **Lokal/Cloud-Speicher-Connector** über USB,
3. zentral konfigurierbares Gateway per **LuCI-Weboberfläche**

betrieben werden kann.

## Deine Anforderungen – so sind sie umgesetzt

- Nur bekannte Server dürfen zugreifen (Allowlist für 4 Public-IPs).
- Bidirektionale Weiterleitung (Cloud↔Heim) nur mit expliziten Regeln.
- USB-Speicher kann als gemeinsamer Ordner für LAN und Cloud genutzt werden.
- Automatische Backups auf USB.
- GUI-Optionen für:
  - Tunnel/Connector-Modus,
  - Storage-Connector,
  - Cloud/LAN-IP-Mappings in beide Richtungen,
  - Firmware/Software-Updates.

## Vorschläge zur Umsetzung (empfohlen)

1. **Transport:** ausschließlich WireGuard (stabil + effizient auf MT7688).
2. **Zugriffsschutz:** Allowlist + Default-Deny + Logging von Drops.
3. **Storage:** ext4-formatierter USB-Stick, Mount auf `/mnt/usbshare`.
4. **Freigabe:** Samba nur für `lan` + `wg0`, kein Gastzugang.
5. **Backups:** tägliche Config-Backups via Cron auf USB.
6. **Updates:** LuCI-App für attendedsysupgrade + kontrollierte Maintenance-Window.
7. **Mapping:** pro Endgerät statische Cloud↔LAN-IP/Port-Zuordnungen mit Ein/Aus-Schalter.

## Neue Weboberfläche: "WB01 Connector"

Es wird eine zusätzliche LuCI-App eingebunden (`luci-app-wb01-connector`) mit 4 Reitern:

- **Tunnel / Connector**
  - Betriebsmodus (Tunnel-only, Tunnel+Storage, Storage-only)
  - Keepalive, MTU, ACL-Policy, Trusted Server
- **Storage & Backup**
  - USB-Mountpoint, Filesystem, Samba-Freigabe
  - Cloud-Sync Toggle
  - Backup-Intervall, Zielpfad, Retention
- **Cloud/LAN Mapping**
  - Lokale IP + Port ↔ Cloud-IP + Port
  - Richtung: LAN→Cloud, Cloud→LAN, bidirektional
- **Updates**
  - Auto-Paketupdates
  - Maintenance-Fenster
  - Firmware-Upgrade via GUI

## Schnellstart

1. Build-Host vorbereiten (Ubuntu/Debian):
   ```bash
   sudo apt update
   sudo apt install -y build-essential clang flex bison g++ gawk \
     gcc-multilib g++-multilib gettext git libncurses-dev libssl-dev \
     python3-distutils rsync unzip zlib1g-dev file wget
   ```
2. Firmware bauen:
   ```bash
   ./scripts/build_wb01.sh
   ```
3. Ergebnis: `openwrt/bin/targets/ramips/mt76x8/`
4. Flashen via `sysupgrade` (im Testnetz validieren).

## Wichtige Platzhalter vor produktivem Einsatz

- WireGuard Keys/Endpoint in `files/etc/config/network`
- Erlaubte 4 Server-IP-Adressen in `files/etc/config/firewall`
- USB-UUID in `files/etc/config/fstab`
- Samba Benutzer/Passwort setzen (kein Gastbetrieb)

## Hinweis

Die WB01-Hardware ist ressourcenbegrenzt (580 MHz / 128 MB RAM). Für maximale Stabilität:

- nur notwendige Dienste aktivieren,
- Logs auf begrenzte Größe halten,
- große Sync-Jobs zeitgesteuert außerhalb Peak-Zeiten ausführen.
