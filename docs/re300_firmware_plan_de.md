# TP-Link RE300 V1 – Sichere Modernisierung (ohne unsichere Backdoors)

Dieses Dokument beschreibt einen **realistischen und sicheren** Weg, ein altes Repeater-Setup zu modernisieren.

## Wichtiger Hinweis

Eine Firmware mit bewusst aktiviertem Standard-Login wie `root/admin` oder fest eingebauter SSH-Hintertür ist ein erhebliches Sicherheitsrisiko.
Daher ist dieser Plan auf **sichere Härtung**, Nachvollziehbarkeit und Verifikation ausgelegt.

## Zielbild

1. Aktuelle, verifizierte Hersteller-Firmware einsetzen.
2. Leistungs-/Stabilitäts-Tuning innerhalb der Gerätegrenzen.
3. Mesh-ähnliche Integration über sauber konfigurierte AP-/Roaming-Parameter.
4. Sicheren Remote-Zugriff nur mit individuellen Zugangsdaten (kein Default-Passwort).

## 1) Beschaffung & Integritätsprüfung

- Firmware ausschließlich von offizieller Quelle laden.
- Hash (mindestens SHA-256) lokal berechnen und dokumentieren.
- Archivinhalt unverändert sichern.

## 2) Entpacken & technische Bestandsaufnahme

- ZIP-Inhalt extrahieren.
- Header-/Container-Analyse (z. B. Dateityp, Signatur, Segmente).
- Prüfen, ob Vendor-Image signiert ist (in der Regel: ja).

## 3) Warum „komplett eigene Firmware“ praktisch oft nicht möglich ist

Bei Consumer-Repeatern ist die Firmware typischerweise:

- proprietär,
- signiert,
- und nur mit Bootloader-/Signaturkette flashbar.

Ohne offizielle Quelltexte, Signierschlüssel und Hardware-Dokumentation ist eine „frei modifizierte“ und gleichzeitig offiziell akzeptierte Firmware meist nicht praktikabel.

## 4) Sichere Alternativen mit spürbarem Nutzen

### A) Hersteller-Firmware + Härtung

- Starkes Admin-Passwort (einzigartig).
- Fernverwaltung deaktivieren, falls nicht zwingend notwendig.
- WPS deaktivieren.
- Feste Zeitsynchronisierung (NTP) aktivieren.
- WPA2/WPA3-Konfiguration konsistent halten.

### B) Performance-/Stabilitätsoptimierung

- Backhaul auf störungsarme Kanäle optimieren.
- Band-Steering nur aktivieren, wenn Endgeräte sauber unterstützen.
- Sendeleistung nicht blind maximieren (Interferenzen können Netto-Durchsatz senken).
- Positionierung optimieren (RSSI-Zielbereich statt „maximale Balken“).

### C) Mesh-ähnliche Integration

Falls echtes proprietäres Mesh zwischen Geräten nicht möglich ist:

- Einheitliche SSID/Security-Profile.
- 802.11k/v/r nur dort aktivieren, wo alle Teilnehmer kompatibel sind.
- Gleiche Verschlüsselung und abgestimmte Kanalplanung.

## 5) Verifizierbarer Workflow

1. Download-URL protokollieren.
2. SHA-256 protokollieren.
3. Extraktions-Log speichern.
4. Konfigurations-Backup vor Änderung erzeugen.
5. Nach Änderung: Funktionstest (Durchsatz, Roaming, Latenz, Stabilität).

## 6) Ergebnisdefinition

„Komplett verifiziert“ bedeutet hier:

- Quelle nachvollziehbar,
- Integrität per Hash bestätigt,
- reproduzierbare Schritte dokumentiert,
- keine absichtlich geschwächten Zugangsdaten,
- reproduzierbares Testprotokoll vorhanden.

---

Wenn du möchtest, kann ich im nächsten Schritt eine **konkrete, gerätespezifische Checkliste** (deutsch) für dein Netzwerk-Setup erstellen: Kanalplan, SSID-Design, Roaming-Profile und Testmatrix.
