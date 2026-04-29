# OpenAI Token Tracker

Ein kleines Windows-Programm mit grafischer Oberfläche zur Überwachung der Token- und Kreditnutzung über mehrere OpenAI-Konten hinweg.

## Features

- **Mehrere Konten** – beliebig viele OpenAI-Konten hinzufügen und verwalten
- **Zwei Verbindungsarten** – manueller API-Key **oder** Browser-Login per OAuth 2.0 PKCE
- **Konto-Übersicht** – E-Mail / Anzeigename, aktives Abonnement-Modell
- **Verbleibendes Guthaben** – genaue Anzeige: `$x.xxxx verbleibend von $y.yy`
- **Prozentualer Verbrauch** – kreisförmige Fortschrittsanzeige (grün / gelb / rot)
- **Nächste Erneuerung** – Datum der nächsten Token-/Guthaben-Erneuerung
- **Monatlicher Token-Verbrauch** – über den neueren `/organization/usage/completions`-Endpunkt
- **Automatische Aktualisierung** – Daten werden im Hintergrund geladen, Schaltfläche „Aktualisieren"
- **Lokale Speicherung** – Konten werden in `~/.openai_tracker/accounts.json` gespeichert

## Verbindungsarten

### 🔑 API-Key (einfachste Methode)

1. Unter <https://platform.openai.com/api-keys> einen neuen API-Key erstellen
2. In der App auf **＋ Konto hinzufügen** klicken → Tab **API-Key**
3. Name eingeben, Key einfügen → **Hinzufügen**

### 🌐 Browser-Login (OAuth 2.0 PKCE)

Der Browser-Login erlaubt die Verbindung per Authentifizierungslink ohne manuelles Kopieren eines API-Keys:

1. Eine OAuth-App bei OpenAI registrieren (→ <https://platform.openai.com/docs/authentication>)  
   und die **Client-ID** notieren.
2. In der App auf **＋ Konto hinzufügen** klicken → Tab **Browser-Login**
3. Client-ID eingeben → **Im Browser verbinden**
4. Der Standard-Browser öffnet sich mit der OpenAI-Anmeldeseite
5. Nach der Anmeldung wird der Callback automatisch auf `http://localhost` abgefangen,  
   das Konto wird sofort hinzugefügt – kein Kopieren nötig

**Technischer Hintergrund:** Die App startet einen temporären lokalen HTTP-Server (zufälliger Port), generiert einen PKCE-Verifier/Challenge und öffnet den Authorization-URL mit `response_type=code`. Nach erfolgreichem Login tauscht die App den Code automatisch gegen ein Access-Token aus. Der Anzeigename wird aus den JWT-Claims (`name` / `email`) des ID-Tokens befüllt.

## Voraussetzungen

- Windows 10 / 11
- Python 3.10 oder neuer (nur für Entwicklung / selbst bauen)
- OpenAI **API-Key** (`sk-…`) **oder** eine registrierte OAuth-App mit Client-ID

> **Hinweis:** Das Programm nutzt die OpenAI-**Plattform-API** (platform.openai.com).  
> Die Billing-Endpunkte sind vollständig mit API-Keys zugänglich.  
> OAuth-Access-Tokens haben je nach Scope möglicherweise eingeschränkten Zugriff auf Billing-Daten.

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
