# Creality Box V2 – Erweiterte Firmware (Router/Repeater/NAS/Swap)

> Hinweis: Ohne den von dir erwähnten offiziellen Firmware-Link und ein Hardware-Dump (SoC, RAM, Flash, Bootloader, Partition-Layout) ist keine vollständig verifizierte, flashbare Final-Firmware möglich. Dieses Dokument liefert ein **umsetzbares, verifizierbares Build- und Integrationskonzept**.

## 1) Zielbild

Die Box soll auf OpenWrt-basierter Firmware laufen und folgende Funktionen erhalten:

- Stabile Nutzung als **Router, Access Point oder Repeater**
- **Mesh-Integration** (802.11s + optional BATMAN-adv)
- USB-Speicher als **NAS im Heimnetz** (Samba + optional NFS)
- **Swap auf SSD/USB-Speicher** für RAM-Entlastung
- Aktivierter **SSH-Zugang**
- Router-ähnliche **Weboberfläche (LuCI)**
- Performance-Tuning bis zur hardwareseitigen Grenze (ohne thermische/elektrische Risiken)

## 2) Sicherheitsvorgabe (wichtig)

Der Wunsch nach Standard-Login `root/admin` ist aus Sicherheitsgründen nicht zu empfehlen.

Stattdessen:

1. SSH ist standardmäßig aktiv.
2. Beim ersten Boot muss ein eigenes starkes Passwort gesetzt werden.
3. Optional kann ein temporärer Setup-Account automatisch entfernt werden.

So bleibt die Box remote administrierbar, aber nicht trivial kompromittierbar.

## 3) Funktionsumfang der erweiterten Firmware

### Netzwerk / Routing

- IPv4/IPv6 Dual Stack
- Firewall4 (nftables)
- DNS + DHCP über dnsmasq
- Hardware-/Software-NAT (abhängig vom SoC)
- SQM (CAKE/FQ-CoDel)

### Repeater / Mesh

- 802.11s Mesh-BSSID
- Fast-Roaming Optionen (802.11r/k/v, falls Treiber/Chipsatz kompatibel)
- Optional BATMAN-adv für Layer-2-Mesh

### Storage / NAS

- ext4 + exFAT + NTFS (je nach Paketwahl)
- Samba-Freigaben (Heimnetz)
- optional NFS-Server
- USB-Automount (block-mount)

### Swap

- Swap-Datei oder Swap-Partition auf SSD
- niedrige Priorität für Flash-Schonung
- VM-Tuning (`vm.swappiness`, `vm.vfs_cache_pressure`)

### Verwaltung

- LuCI Webinterface
- SSH (Dropbear oder OpenSSH)
- Backup/Restore von UCI-Konfiguration

## 4) Referenz-Paketliste (OpenWrt)

- `luci`, `luci-ssl`, `uhttpd`
- `wpad-mesh-openssl` (oder passende WPA/Mesh-Variante)
- `batctl`, `kmod-batman-adv` (optional)
- `samba4-server`, `luci-app-samba4`
- `block-mount`, `kmod-usb-storage`, `kmod-fs-ext4`
- `kmod-fs-exfat`, `kmod-fs-ntfs3` (optional)
- `luci-app-attendedsysupgrade` (optional)
- `sqm-scripts`, `luci-app-sqm`
- `htop`, `iftop`, `collectd` (Monitoring optional)

## 5) Verifizierungs-Checkliste

Vor dem Flashen:

- [ ] Identifikation SoC, RAM, Flash, WLAN-Chip
- [ ] Extraktion Original-Firmware (`binwalk`, `strings`, `hexdump`)
- [ ] Bootloader-Infos (U-Boot o.ä.)
- [ ] Partition-Layout bestätigt
- [ ] Recovery-Pfad getestet (UART/TFTP/USB)

Nach dem Flashen:

- [ ] WAN/LAN Routing stabil 24h
- [ ] Durchsatztest (`iperf3`) im Router- und Repeater-Modus
- [ ] Mesh-Knoten-Rejoin nach Reboot
- [ ] USB-Mount + Samba-Read/Write
- [ ] Swap aktiv (`swapon --show`)
- [ ] Temperaturen unter Last im sicheren Bereich
- [ ] Konfigurationspersistenz nach Neustart

## 6) Leistungs-Tuning (praxisnah)

- IRQ-Affinität und SoftIRQ-Verteilung optimieren
- DNS-Cache und conntrack sinnvoll dimensionieren
- WLAN-Kanalplanung (2.4/5 GHz), feste Kanalbreite statt Auto bei Störungen
- SQM korrekt am WAN-Engpass setzen
- unnötige Dienste deaktivieren
- Log-Level reduzieren, um I/O zu sparen

## 7) Nächste Schritte für eine echte Build-Auslieferung

Bitte bereitstellen:

1. Offizieller Firmware-Link (den du erwähnt hast)
2. `sha256` der Firmwaredatei
3. Hardware-Revision/Fotos vom Board
4. Serial/UART-Bootlog
5. Output von:
   - `cat /proc/cpuinfo`
   - `cat /proc/meminfo`
   - `cat /proc/mtd`
   - `dmesg`

Dann kann ein **konkretes, reproduzierbares Build-Profil** erzeugt und gegen dein Gerät verifiziert werden.
