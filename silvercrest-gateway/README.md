# Silvercrest Zigbee Gateway — All-in-One Firmware Builder

> **Quelle:** [jnilo1/hacking-lidl-silvercrest-gateway](https://github.com/jnilo1/hacking-lidl-silvercrest-gateway) (MIT-Lizenz)  
> Dieses Verzeichnis enthält ein automatisiertes Build-System, das die komplette
> Firmware aus dem Upstream-Projekt zusammenstellt.

---

## Was wird gebaut?

| Datei | Beschreibung |
|-------|-------------|
| `output/fullflash.bin` | Vollständiges 16 MiB Flash-Image für den RTL8196E (Bootloader + Kernel + RootFS + Userdata) |
| `output/ncp-uart-hw-7.5.1.gbl` | EFR32 Zigbee-NCP-Firmware (EmberZNet 7.5.1) für Zigbee2MQTT / ZHA |

Das Gateway ersetzt die Tuya-Cloud-Firmware durch ein vollständig **lokales**, offenes
Smart-Home-Hub:
- **SSH-Zugang** (Dropbear, Port 22)  
- **Zigbee-Coordinator** via TCP-Serialproxy (Port 8888) — direkt mit Zigbee2MQTT oder ZHA  
- **Thread Border Router** (OTBR) als Alternative  
- **OTA-Firmware-Updates** für das Zigbee-Radio  

---

## Voraussetzungen

### Hardware
- Lidl Silvercrest Zigbee Gateway (Artikel-Nr. HG06668)
- USB-to-Serial-Adapter (3,3 V, 38400 8N1) — **nur für den ersten Flash**
- Ethernet-Kabel

### Software (für den Build)
- **Docker** (empfohlen, jede Plattform)  
  → [Installationsanleitung](https://docs.docker.com/engine/install/)
- **ODER** Ubuntu 22.04 mit installierten Build-Abhängigkeiten  
  → `sudo .upstream/1-Build-Environment/install_deps.sh`

---

## Kurzanleitung

### 1. Firmware bauen

```bash
# Standard: DHCP + Zigbee (empfohlen für die meisten Setups)
./build.sh

# Statische IP:
./build.sh --net-mode static --ip 192.168.1.88 --netmask 255.255.255.0 --gateway 192.168.1.1

# Thread Border Router statt Zigbee:
./build.sh --radio-mode thread
```

Erster Lauf: ~45 Minuten (Docker-Image wird aufgebaut, inkl. MIPS-Cross-Compiler).  
Folgeläufe: ~2–5 Minuten.

### 2. Linux-System flashen (erster Flash)

> Benötigt USB-Serial-Adapter (3,3 V, 38400 8N1)

1. Serial-Konsole öffnen (z. B. `minicom -b 38400 -D /dev/ttyUSB0`)
2. Gateway einschalten → innerhalb 1 Sekunde **ESC** drücken  
   → Prompt: `<RealTek>`
3. Flash-Script starten:

```bash
./flash.sh --first-flash
```

Das Script überträgt `fullflash.bin` per TFTP und gibt den `FLW`-Befehl für die
Serial-Konsole aus. Schreibvorgang ~2 Minuten.

**Standard-Login nach dem Flash:**
```
SSH: root@<GATEWAY_IP>:22  (kein Passwort)
```

### 3. Upgrade über SSH (kein Serial nötig)

```bash
./flash.sh --upgrade 192.168.1.88
# oder vollautomatisch (ab Firmware v2.0.0):
./flash.sh --upgrade 192.168.1.88 -y
```

### 4. Zigbee-Radio flashen

```bash
./flash.sh --radio 192.168.1.88
```

Wähle im Menü **NCP-UART-HW** (EmberZNet 7.5.1) für Zigbee2MQTT / ZHA.

### 5. Zigbee2MQTT verbinden

In `configuration.yaml`:

```yaml
serial:
  port: tcp://192.168.1.88:8888
  adapter: ember
```

---

## Build-Optionen

```
./build.sh [OPTIONS]

  --net-mode   static|dhcp      Netzwerkmodus (Standard: dhcp)
  --ip         <IP>             Statische IP  (Standard: 192.168.1.88)
  --netmask    <MASK>           Netzmaske     (Standard: 255.255.255.0)
  --gateway    <GW>             Gateway       (Standard: 192.168.1.1)
  --radio-mode zigbee|thread    Radiomodus    (Standard: zigbee)
  --no-cache                    Docker-Image neu aufbauen
  --skip-docker                 Nativer Build (Ubuntu 22.04 + deps)
  --output     <DIR>            Ausgabeverzeichnis (Standard: ./output)
```

---

## Flash-Optionen

```
./flash.sh --first-flash [--boot-ip <IP>]
./flash.sh --upgrade <GATEWAY_IP> [-y]
./flash.sh --radio   <GATEWAY_IP> [--mode ncp|rcp|otrcp|router]
```

---

## Verzeichnisstruktur

```
silvercrest-gateway/
├── build.sh        ← Haupt-Build-Script (alles in einem)
├── flash.sh        ← Flash-Script für alle Schritte
├── README.md       ← Diese Datei
├── output/         ← Fertige Firmware-Dateien (nach dem Build)
│   ├── fullflash.bin
│   └── ncp-uart-hw-7.5.1.gbl
└── .upstream/      ← Geclontes Upstream-Repo (automatisch erstellt)
```

---

## Partitionen des Flash-Images

| Offset | Größe | Inhalt |
|--------|-------|--------|
| 0x000000 | 128 KiB | Bootloader (RTL8196E) |
| 0x020000 | 1920 KiB | Linux-Kernel 5.10 (MIPS/Lexra) |
| 0x200000 | 2048 KiB | RootFS (SquashFS: BusyBox + Dropbear) |
| 0x400000 | 12288 KiB | Userdata (JFFS2: Konfiguration, serialgateway, nano) |

---

## Danksagung

Dieses Projekt basiert auf der Arbeit von
[J. Nilo](https://github.com/jnilo1/hacking-lidl-silvercrest-gateway)
und den ursprünglichen Reverse-Engineering-Arbeiten von
[Paul Banks](https://paulbanks.org/projects/lidl-zigbee/).  
Lizenz: MIT.
