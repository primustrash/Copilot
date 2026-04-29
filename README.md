# OpenAI Token Tracker

Ein kleines Windows-Programm mit grafischer Oberfläche zur Überwachung der Token- und Kreditnutzung über mehrere OpenAI-Konten hinweg.

## Features

- **Mehrere Konten** – beliebig viele OpenAI-Konten (API-Keys) hinzufügen und verwalten
- **Konto-Übersicht** – E-Mail / Anzeigename, aktives Abonnement-Modell
- **Verbleibendes Guthaben** – genaue Anzeige: `$x.xxxx verbleibend von $y.yy`
- **Prozentualer Verbrauch** – kreisförmige Fortschrittsanzeige (grün / gelb / rot)
- **Nächste Erneuerung** – Datum der nächsten Token-/Guthaben-Erneuerung
- **Monatlicher Token-Verbrauch** – über den neueren `/organization/usage/completions`-Endpunkt
- **Automatische Aktualisierung** – Daten werden im Hintergrund geladen, Schaltfläche „Aktualisieren"
- **Lokale Speicherung** – Konten werden verschlüsselungsfrei in `~/.openai_tracker/accounts.json` gespeichert

## Voraussetzungen

- Windows 10 / 11
- Python 3.10 oder neuer (nur für Entwicklung / selbst bauen)
- OpenAI **API-Key** (`sk-…`) – erhältlich unter <https://platform.openai.com/api-keys>

> **Hinweis:** Das Programm nutzt die OpenAI-**Plattform-API** (platform.openai.com),  
> nicht das ChatGPT-Web-Interface. Die Billing-Endpunkte sind für API-Konten verfügbar.

## Schnellstart (aus dem Quellcode)

```bat
# Abhängigkeiten installieren
pip install -r requirements.txt

# Programm starten
python src/main.py
```

## Windows-.exe bauen

```bat
build.bat
```

Die fertige Datei liegt danach unter `dist\OpenAI Token Tracker.exe` und benötigt kein installiertes Python.

## Verwendete API-Endpunkte

| Endpunkt | Zweck |
|---|---|
| `GET /v1/billing/subscription` | Abonnement-Typ, Limits, Zugangsdatum |
| `GET /v1/billing/usage` | Monatlicher Verbrauch in USD |
| `GET /dashboard/billing/credit_grants` | Kreditguthaben (gewährt / verbraucht / verfügbar) |
| `GET /v1/organization/usage/completions` | Token-Nutzung (neuer Endpunkt) |

## Projektstruktur

```
├── src/
│   └── main.py          # Gesamte Anwendung (eine Datei)
├── requirements.txt     # Python-Abhängigkeiten
├── build.bat            # Build-Skript (→ .exe via PyInstaller)
└── README.md
```
