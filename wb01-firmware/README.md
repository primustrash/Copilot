# Custom Firmware (WB01 / Creality Box) – Secure Cloud↔Heimnetz Bridge

Diese Vorlage erstellt eine **OpenWrt-basierte Firmware** für die WB01-Hardware
(MT7688AN, 128 MB RAM/Flash), die als gehärtete Bridge zwischen Cloud-Server und Heimnetz betrieben wird.

## Zielbild

- Gerät verbindet sich als **WireGuard-Client** zu einem Cloud-Server.
- Kann optional zusätzlich eine **öffentliche WAN-IP** nutzen.
- Weiterleitung ist auf explizit erlaubte Ports/Netze begrenzt.
- Nur bekannte Server dürfen zugreifen (Allowlist).
- Vollständig über **LuCI-Weboberfläche** konfigurierbar.

## Sicherheitsprinzipien

1. **Default-Deny Firewall**: Nichts wird ungefragt weitergeleitet.
2. **Fail-Closed**: Bei Tunnel-Ausfall kein ungesicherter Fallback.
3. **Server-Allowlist**: Nur exakt definierte Cloud-Server sind erlaubt.
4. **WebUI nur über LAN/VPN**: Kein offener WAN-Adminzugang.
5. **Minimale Angriffsfläche**: Nur benötigte Pakete + Dienste.

## Zugriff nur für 4 bekannte Server (dein Wunsch)

In `files/etc/config/firewall` sind Platzhalter hinterlegt:

- `trusted_cloud_servers` (Public IPv4):
  - `203.0.113.10`
  - `203.0.113.11`
  - `198.51.100.20`
  - `198.51.100.21`
- Erlaubt nur diese 4 Server auf UDP/51820 (WireGuard).
- Alle anderen Quellen werden auf diesem Port geblockt.

Zusätzlich gibt es ein Beispiel für LAN-Zugriff aus dem Tunnel, ebenfalls auf 4 feste Quellen begrenzt (`10.99.0.10-13`).

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
3. Ergebnis liegt in `openwrt/bin/targets/ramips/mt76x8/`.
4. Flashen per OpenWrt-`sysupgrade` (passendes Imageformat prüfen).

## Cloud↔Heim und Heim↔Cloud synchron weiterleiten

- **Heim -> Cloud**: Forwarding `lan -> wgcloud` ist aktiv.
- **Cloud -> Heim**: Nur mit expliziten Regeln (z.B. Drucker-Port 9100 oder Management 443).
- Für weitere Dienste einfach zusätzliche, enge Firewall-Regeln anlegen.
- Empfohlen: Nur notwendige Ports und nur feste Quell-IP-Adressen erlauben.

## Weboberfläche (LuCI)

Nach dem Flash:

- LuCI: `https://<WB01-IP>/`
- Relevante Menüs:
  - Network → Interfaces (WAN/WG)
  - Network → Firewall (Rules/Traffic Rules)
  - VPN → WireGuard
  - System → Startup / Reboot / Software

## Wichtig

- Vor Produktivbetrieb in Testumgebung prüfen.
- Ersetze alle Platzhalter-Schlüssel/IPs durch echte Werte.
- Für hohe Stabilität: externes Monitoring, USV, Backup-Config, staged Rollouts.
